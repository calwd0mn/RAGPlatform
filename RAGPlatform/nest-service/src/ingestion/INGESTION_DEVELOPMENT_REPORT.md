# Ingestion 模块开发报告

## 1. 目标与范围

本次开发目标是在现有 NestJS 项目中实现后端 `ingestion` 模块，完成“已上传文档 -> 可检索 chunk 数据”的最小可用闭环。

本次范围仅包含：

- 文档归属校验与状态校验
- 文档文件读取（基于 `Document.storagePath`）
- Loader / Splitter / Embedding / Chunk 持久化
- 文档状态流转与失败回写
- `POST /ingestion/:documentId/start` 接口
- 最小必要测试覆盖

明确不包含：

- RAG 问答接口
- assistant 消息写入
- rerank / hybrid retrieval / queue / LangGraph orchestration

## 2. 关键约束落实

- 严格按模块分层：Controller 只做路由与参数，Service 负责业务
- 全链路用户隔离：所有资源按 `userId` 校验
- DTO + class-validator：`StartIngestionParamDto` 做 `documentId` 校验
- TypeScript 无 `any`
- 不改动 auth / conversations / messages / documents 的既有行为

## 3. 数据模型设计

新增 `Chunk` schema，字段包含：

- `userId: ObjectId`
- `documentId: ObjectId`
- `chunkIndex: number`
- `content: string`
- `embedding: number[]`
- `metadata`（page/source/originalName/mimeType/documentId/userId 等）
- `createdAt/updatedAt`

索引：

- `documentId + chunkIndex`（唯一）
- `userId + documentId`

## 4. 状态机与一致性策略

状态流转：

- 可启动：`uploaded` / `failed`
- 启动后：`parsing`
- 处理中：`parsed` -> `chunked` -> `embedded`
- 成功：`ready`
- 失败：`failed` + `errorMessage`

并发一致性修复：

- 采用原子 `findOneAndUpdate`（条件含 `status in [uploaded, failed]`）抢占处理权
- 同文档并发请求只允许一个成功进入流程，其余返回冲突

失败处理：

- 失败时清理当前文档 chunks，回写 `failed + errorMessage`
- 重试（failed）前会清理旧 chunks，避免新旧混合

## 5. LangChain 使用与组织

采用的官方能力：

- `@langchain/community`：`PDFLoader`
- `@langchain/textsplitters`：`RecursiveCharacterTextSplitter`
- `@langchain/core`：`Document`、`Embeddings` 抽象

工程组织：

- `loaders/document-loader.factory.ts`
- `splitters/text-splitter.factory.ts`
- `embeddings/embeddings.factory.ts`
- `mappers/langchain-document.mapper.ts`
- `builders/chunk-metadata.builder.ts`

说明：

- 在 LangChain v1 下，文本 FS loader 的可用路径与 Jest 运行时兼容性存在限制；为保证稳定与最小依赖，txt/md 采用 Node `fs` 读取并统一封装在 loader factory。

## 6. API 说明

### `POST /ingestion/:documentId/start`

鉴权：Bearer Token（JWT）

返回：

- `documentId`
- `finalStatus`
- `chunkCount`
- `message`

错误场景：

- 非本人文档：404
- 非法状态：400 / 409（如 `ready` 或 `parsing`）
- 不支持类型：400
- 流水线异常：500（并回写 `failed`）

## 7. 测试与回归

新增 e2e：`test/ingestion.e2e-spec.ts`

覆盖：

- 本人 `uploaded` 文档入库成功
- 入库后 `chunk` 写入、数量大于 0、`document.status=ready`
- 越权处理被拒绝
- 不允许状态被拒绝
- embedding 失败后状态为 `failed` 且写入 `errorMessage`
- failed 重试时清理旧 chunks
- 同文档并发 start 仅一个成功（201 + 409）

全量验证：

- `npm run build` 通过
- `npm test -- --runInBand` 通过
- `npm run test:e2e -- --runInBand` 通过

## 8. LangChain v1 迁移结果

当前依赖：

- `langchain@1.3.3`
- `@langchain/core@1.1.40`
- `@langchain/community@1.1.27`
- `@langchain/textsplitters@1.0.1`

并完成：

- v1 导入路径兼容调整
- 删除顶层 `@langchain/classic` 直接依赖
- `test:e2e` 恢复普通 jest（不再全局 `--experimental-vm-modules`）

## 9. 测试配置改进

为消除 `ts-jest` 的 `TS151002` 警告，本次在 Jest 的 `ts-jest` 配置中加入：

- `diagnostics.ignoreCodes: [151002]`

说明：

- 该方案不改变现有 TypeScript 编译选项，不影响 `emitDecoratorMetadata` 行为
- 避免了 `isolatedModules` 对 Nest Mongoose 装饰器元数据推断的副作用

## 10. 依赖检查改进

针对 `@langchain/community` 大量 optional 依赖提示，本次新增脚本：

- `npm run deps:check`（实际执行 `npm ls --omit=optional --depth=0`）

用途：

- 作为日常依赖健康检查，避免将 optional 依赖提示误判为安装失败
