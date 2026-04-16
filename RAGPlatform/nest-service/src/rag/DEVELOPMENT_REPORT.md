# RAG 模块开发报告

## 1. 任务背景与目标

本次任务在现有 NestJS + MongoDB + JWT + LangChain.js 项目中实现后端 `rag` 模块，形成最小可用闭环：

`query -> query embedding -> retrieval -> prompt -> generate -> citations -> message persistence`

本次明确不引入：LangGraph checkpointer、queue、rerank、hybrid retrieval、streaming、tool calling、多模态等增强能力。

---

## 2. 约束遵循情况

- 严格按 `AGENTS.md` 进行模块分层：controller / service / dto / mappers / builders / retrievers / factories / prompts / interfaces。
- TypeScript 未使用 `any` 与 `unknown`。
- controller 仅处理路由与参数，业务逻辑在 service。
- 输入使用 DTO + class-validator。
- conversation 与 chunk 均进行用户归属隔离校验。
- 不改动已联调通过模块既有行为（auth / conversations / messages / documents / ingestion）。

---

## 3. 新增与修改内容

### 3.1 RAG 模块新增文件

- `dto/ask-rag.dto.ts`
  - 定义 `conversationId`、`query`、`topK` 入参校验。
- `interfaces/rag-answer.interface.ts`
  - 统一返回结构：`answer/citations/trace/conversationId/userMessageId/assistantMessageId`。
- `interfaces/rag-citation.interface.ts`
  - citation 数据结构。
- `interfaces/rag-trace.interface.ts`
  - trace 数据结构。
- `prompts/rag-answer.prompt.ts`
  - 系统提示词，约束仅基于 context 回答、无证据时明确说明。
- `builders/rag-context.builder.ts`
  - 将检索结果构造成模型可读上下文。
- `mappers/message-history.mapper.ts`
  - 将业务 message 映射为 LangChain message（Human/AI/System）。
- `mappers/chunk-to-citation.mapper.ts`
  - 将检索 chunk 映射为 citation。
- `retrievers/rag-retrieval.service.ts`
  - 独立检索层（过渡版 embedding 相似度检索）。
- `factories/rag-chat-model.factory.ts`
  - 统一模型工厂，支持 fake / 非 fake provider。

### 3.2 RAG 模块改造文件

- `rag.controller.ts`
  - 新增 `POST /rag/ask`，JWT 保护。
- `rag.service.ts`
  - 实现 RAG 主链路和消息落库。
- `rag.module.ts`
  - 注入 Message / Chunk model 及相关依赖。
- `rag.controller.spec.ts`
  - 控制器委托行为测试。
- `rag.service.spec.ts`
  - 服务层行为测试（主路径与错误路径）。

### 3.3 关联模块最小改动

- `src/ingestion/ingestion.module.ts`
  - 导出 `IngestionEmbeddingsFactory` 供 rag 复用。
- `src/messages/interfaces/message-trace.interface.ts`
  - 新增 `retrievedCount?: number`。
- `src/messages/schemas/message.schema.ts`
  - trace 子结构新增 `retrievedCount` 持久化字段。

---

## 4. 接口实现说明

## POST /rag/ask

### 请求体

- `conversationId: string`（MongoId）
- `query: string`（1~2000，非空白）
- `topK?: number`（1~20，默认 5）

### 处理流程

1. 校验 `conversationId` 和会话归属（当前用户）。
2. 写入 user message。
3. 更新 conversation `lastMessageAt`。
4. 读取最近 N 条历史消息（当前 N=8）。
5. 使用 `IngestionEmbeddingsFactory` 生成 query embedding。
6. 检索当前用户可访问 chunk（按 `userId` 隔离）。
7. 构造 context + citations。
8. 通过 LangChain prompt/message/model 生成 answer。
9. 写入 assistant message（含 citations / trace）。
10. 更新 conversation `lastMessageAt` 并返回结果。

### 返回体

- `answer`
- `citations`
- `trace`
- `conversationId`
- `userMessageId`
- `assistantMessageId`

---

## 5. LangChain.js 使用情况

本次实现使用了以下官方能力：

- `ChatPromptTemplate`
- `MessagesPlaceholder`
- `HumanMessage / AIMessage / SystemMessage`
- `RunnableSequence`
- `StringOutputParser`
- `Embeddings` 抽象（通过 ingestion factory 复用）

说明：本次不引入 LangGraph memory/checkpointer，保持最小链路闭环。

---

## 6. 检索层设计与性能策略

### 6.1 可替换检索层

检索逻辑已封装在 `RagRetrievalService`，业务 service 不直接依赖具体检索实现，后续可平滑替换为正式向量检索后端。

### 6.2 当前检索策略（过渡版）

- 用户隔离：Mongo 查询强制 `userId`。
- 相似度：余弦相似度。
- topK：按分数排序后截断。

### 6.3 性能优化（本轮修复）

为避免“全量拉取用户所有 chunk 内容+向量”导致内存压力：

- 先拉取有限候选（默认最大 3000，可通过 `RAG_RETRIEVAL_MAX_CANDIDATES` 调整）且仅取 embedding。
- 计算 topK 后，再二次查询命中 chunk 的 content。

---

## 7. 一致性与错误处理

### 7.1 一致性策略（本轮修复）

`RagService` 中“写 message + 更新 conversation.lastMessageAt”已改为同一事务执行，覆盖 user message 与 assistant message 两段流程，避免出现“message 已写入但接口报错”的不一致。

### 7.2 关键错误分支

- 非法 conversationId -> `BadRequestException('Invalid id')`
- conversation 不存在/越权 -> 继承 conversations 模块 `NotFoundException('Conversation not found')`
- embedding 失败 -> `InternalServerErrorException('Failed to generate query embedding')`
- retrieval 失败 -> `InternalServerErrorException('Failed to retrieve relevant chunks')`
- model 调用失败 -> `InternalServerErrorException('Failed to generate answer')`
- message 持久化失败 -> `InternalServerErrorException('Failed to persist message')`

---

## 8. 高危问题修复记录

本轮针对 review 发现的 3 个风险已修复：

1. 生产环境 fake 模型风险
- 修复：当 `NODE_ENV=production` 且 `RAG_CHAT_PROVIDER=fake` 时直接抛错，禁止静默回退假模型。

2. assistant message 落库后失败导致接口报错
- 修复：改为事务，保证 message 与 `lastMessageAt` 一致提交。

3. 检索全量拉取导致性能退化
- 修复：改为“候选限流 + topK 二次取内容”。

---

## 9. 测试与验证

已执行：

- `npx jest src/rag/rag.service.spec.ts src/rag/rag.controller.spec.ts --runInBand`
- `npm run build`

结果：

- rag 定向测试通过（2 suites / 6 tests）
- 项目构建通过

说明：当前环境下 jest 多进程模式可能触发 `spawn EPERM`，因此使用 `--runInBand` 串行执行。

---

## 10. 运行与联调建议

### 10.1 环境变量建议

- 开发环境可使用：
  - `RAG_CHAT_PROVIDER=fake`（便于本地联调链路）
- 生产环境必须使用真实 provider：
  - 例如 `RAG_CHAT_PROVIDER=openai`（并配置对应 key 与 model）
  - 若误配为 fake，会被代码拒绝启动调用。

### 10.2 接口联调示例

`POST /rag/ask`

```json
{
  "conversationId": "507f1f77bcf86cd799439011",
  "query": "请总结这份文档的权限控制策略",
  "topK": 5
}
```

---

## 11. 后续可迭代项（未纳入本次）

- 正式向量数据库/向量索引接入
- rerank 与 hybrid retrieval
- streaming 输出
- LangGraph memory/checkpointer
- retrieval trace 明细持久化
- 统一事务策略进一步抽取到共享基础层
