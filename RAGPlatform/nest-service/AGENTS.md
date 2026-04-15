# AGENTS.md

## 1. 文档目的

本文件用于约束本项目中所有 AI 代码代理、自动补全工具、协作开发者在 **后端** 范围内的实现方式、目录规范、编码风格、边界划分与交付标准。

本项目后端技术栈为：

- NestJS
- TypeScript
- MongoDB / Mongoose
- LangChain.js
- JWT
- Axios（仅在服务端需要调用外部服务时使用）
- CORS
- Node.js

本文件的目标不是描述业务功能细节，而是确保：

1. 后端架构保持稳定、可维护、可扩展
2. AI 功能尽可能基于 LangChain.js 官方能力封装实现
3. TypeScript 保持强类型，不使用 `any`
4. 每个模块目录职责清晰，避免混乱堆叠
5. RAG、会话、鉴权、文档处理链路具备统一实现规范

---

## 2. 总体原则

### 2.1 后端优先
本项目以 **后端主链路优先** 的方式推进开发。  
所有新增功能优先考虑以下闭环是否完整：

`鉴权 -> 文档上传 -> 文档解析 -> chunk 切分 -> embedding -> 检索 -> 生成 -> 会话落库 -> 返回证据`

### 2.2 先稳定主链路，再做增强能力
优先实现：

- 用户鉴权
- 文档入库
- RAG 问答
- 会话持久化
- 证据返回

增强能力如：

- query rewrite
- rerank
- 混合检索
- LangGraph 工作流
- prompt versioning
- 检索 trace 面板

必须在主链路稳定后再接入。

### 2.3 不重复造轮子
对于 AI 相关能力，**优先使用 LangChain.js 官方可用能力封装**，不要手写重复逻辑替代官方已有抽象，除非：

1. 官方能力无法满足需求
2. 现有封装严重影响可维护性
3. 自定义实现具有明确业务必要性

### 2.4 强类型优先
所有 TypeScript 代码必须坚持强类型设计：

- 禁止使用 `any`
- 优先使用 `interface`、`type`、泛型、联合类型、类型守卫
- 必要时使用 `unknown`，然后显式收窄
- 所有 service 返回值、controller DTO、数据库模型、AI 输出结构都必须有明确类型

### 2.5 单一职责
模块、服务、方法都应尽量保持职责单一：

- Controller 只负责请求接入、参数校验、响应返回
- Service 负责业务逻辑
- Repository / Model 层负责数据读写
- AI / RAG 逻辑集中在专门模块中，不要散落到通用业务模块

---

## 3. AI 功能实现原则

## 3.1 LangChain.js 优先策略
所有 AI 相关实现，优先按以下顺序选型：

1. LangChain.js 官方现成功能
2. LangChain.js 可组合能力进行二次封装
3. 少量自定义 glue code
4. 仅在必要时编写底层替代逻辑

优先使用的 LangChain.js 能力包括但不限于：

- Document Loaders
- Text Splitters
- Embeddings
- Vector Store / Retriever
- PromptTemplate / ChatPromptTemplate
- RunnableSequence / RunnableLambda
- Output Parsers
- Message History 抽象
- LangGraph（仅在需要状态流、可恢复执行、多节点编排时使用）

### 3.2 禁止“伪 LangChain 化”
不要把本质上完全手写的逻辑简单包一层然后称作 LangChain 实现。  
如果某功能使用 LangChain.js，应体现出其真实价值，例如：

- 使用官方 loader 处理文档
- 使用官方 splitter 切块
- 使用 retriever 封装召回
- 使用 runnable 串联流程
- 使用官方 prompt/message 抽象
- 使用 structured output parser 保证输出格式

### 3.3 AI 模块边界清晰
以下逻辑应优先集中到 AI / RAG 模块中：

- 文档转 LangChain Document
- chunk 切分
- embedding 生成
- retriever 创建
- prompt 构造
- context 拼接
- LLM 调用
- citations 映射
- trace 结构输出

业务模块不应直接拼 prompt 或直接调用模型。

### 3.4 优先可解释，不优先炫技
本项目是面向文档的 RAG 平台。  
AI 输出必须优先满足：

1. 基于证据回答
2. 返回引用来源
3. 上下文可追踪
4. 无证据时明确说明不足

不要优先追求“更像聊天”而牺牲可解释性。

---

## 4. TypeScript 约束

### 4.1 禁止 any
全项目禁止：

```ts
const x: any = ...
function foo(arg: any): any {}
4.2 推荐替代方式

优先使用：

unknown
Record<string, unknown>
明确 DTO 类型
interface
type
zod / class-validator 辅助结构约束（如项目后续接入）
泛型 <T>
4.3 所有返回值显式声明

示例：

async createConversation(dto: CreateConversationDto, userId: string): Promise<ConversationDto> {}

禁止省略复杂函数的返回类型。

4.4 外部数据必须做收窄

对于第三方 SDK、模型输出、动态 JSON、Mongo 聚合结果，不要直接信任其结构，必须：

先定义类型
必要时增加 parser / mapper
对不确定字段做判空和类型保护
每个业务模块应尽量采用以下分工：

controllers/
只处理路由、参数、调用 service、返回结果
不写复杂业务逻辑
不直接操作数据库
不直接写 prompt
services/
处理业务逻辑
可组合多个 service
可调用 model/repository
可调用 ai/rag service
dto/
请求、响应 DTO
输入校验
出参结构声明
DTO 命名需明确，如 CreateConversationDto
schemas/
Mongoose schema 定义
不混杂业务逻辑
interfaces/
模块内部核心类型定义
不要把一切都放到 global types
与 DTO 区分：interface 更偏内部结构与领域结构
mappers/
负责数据库对象、AI 输出、DTO 之间转换
Controller 不应手动拼复杂返回格式
prompts/
仅存放 prompt 模板或 prompt 构造器
不与业务 service 混杂
builders/
用于构造 retrieval context、LLM input、message history 等复杂结构
retrievers/
负责封装 retriever 创建或检索组合逻辑
不要把 retriever 逻辑散落在多个 service 内
parsers/
负责模型输出解析、结构化输出处理、citation 映射等
factories/
用于创建模型实例、embedding 实例、retriever 实例、chain 实例
7. 命名规范
7.1 文件命名

统一使用 kebab-case：

create-conversation.dto.ts
rag-answer.service.ts
document-chunk.mapper.ts
7.2 类命名

使用 PascalCase：

AuthService
RagService
ConversationSchema
CreateMessageDto
7.3 变量与函数

使用 camelCase：

createConversation
buildRetrievalContext
mapChunkToCitation
7.4 接口命名

推荐明确领域含义，不强制 I 前缀：

RagAnswer
RetrievalTrace
ChunkCitation
DocumentChunkMetadata
8. 数据模型设计约束

第一阶段核心集合至少包括：

users
conversations
messages
documents
chunks

可选增强集合：

retrieval_runs
prompt_versions
workspaces
knowledge_bases
8.1 Message 必须支持 citations

消息模型不能只保存纯文本内容。
至少应支持：

role
content
citations
trace
conversationId
userId
createdAt
8.2 Document 必须支持状态流转

文档状态至少应可表示：

uploaded
parsing
parsed
chunked
embedded
ready
failed
8.3 Chunk 必须保留 metadata

chunk 除正文和 embedding 外，必须保留必要 metadata，例如：

documentId
userId
chunkIndex
page
source
startOffset
endOffset
9. API 设计规范
9.1 Controller 返回结构统一

推荐统一响应格式：

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

错误响应也应统一，不允许风格混乱。

9.2 DTO 驱动

所有 controller 入参都必须通过 DTO + class-validator 校验。
禁止直接接收无类型裸对象后手动处理。

9.3 不在 Controller 拼装复杂领域对象

复杂返回结果放到 mapper 或 service 中生成。

9.4 RAG 接口必须返回证据

POST /rag/ask 这类接口，返回结果至少包含：

answer
citations
trace
conversationId
messageId（如适用）
10. RAG 实现规范
10.1 最小链路

第一阶段 RAG 闭环必须遵循：

query -> query embedding -> topK retrieval -> prompt -> llm -> citations mapping -> persistence

10.2 检索优先，历史次之

多轮会话时，优先级为：

当前问题对应的检索证据
最近若干轮消息上下文
历史摘要（如后续接入）

禁止直接把全量历史无上限拼进 prompt。

10.3 Prompt 必须约束幻觉

所有问答类 prompt 应明确要求：

只能基于提供的 context 回答
context 不足时明确说明
不得捏造来源
回答尽量引用证据内容
10.4 Citation 映射不可丢

从 chunk 到前端 evidence 的映射必须保留完整链路：

chunkId
documentId
documentName
content
score
page / source（如有）
10.5 Trace 可扩展

RAG 结果建议预留 trace 字段，例如：

query
rewrittenQuery
topK
retrievedCount
model
latencyMs
11. LangChain.js 封装建议

优先按以下思路封装：

11.1 模型工厂

统一在 factory 中创建：

chat model
embeddings model
retriever
document loader

不要在各个 service 内零散 new。

11.2 Chain 封装

优先使用 LangChain runnable 思路，而不是大段 procedural code。

推荐拆分为：

context builder
answer chain
citation mapper
history formatter
11.3 Prompt 独立管理

Prompt 不要内联在 service 方法中，除非极短且不会复用。
优先放入 prompts/ 目录并导出明确命名的模板。

11.4 Parser 独立管理

结构化输出、JSON 输出、citation 提取等解析逻辑应放入 parsers/，不要在 controller / service 中直接字符串处理。

12. 日志、异常与可观测性
12.1 关键链路必须有日志

至少对以下过程打日志：

登录
文档上传
文档解析开始/结束
embedding 开始/结束
RAG 查询
检索耗时
生成耗时
持久化失败

日志中不得输出敏感信息，如明文密码、token、完整私密文档正文。

12.2 异常分类

优先区分：

参数错误
鉴权错误
资源不存在
业务状态错误
第三方模型调用失败
数据库操作失败
12.3 对外信息适度

返回给前端的错误信息应可理解，但不要泄露内部实现细节。

13. 安全要求
13.1 JWT
所有用户私有资源接口默认需要鉴权
conversation、message、document 查询必须校验资源归属
13.2 文件上传
限制 mime type
限制大小
不信任前端传入文件名
持久化时保存安全路径
解析前做基础合法性检查
13.3 输入清洗
对 query、标题、搜索关键字等输入做基本校验
防止过长输入直接进入 prompt 或数据库
13.4 多用户隔离

所有 RAG 检索必须具备用户级、空间级或知识库级隔离能力，禁止跨用户误召回。

14. 性能与扩展要求
14.1 不要过早优化

第一阶段优先做通最小闭环，不强行提前引入复杂异步队列、缓存系统或微服务拆分。

14.2 预留扩展点

代码结构需为后续以下能力预留空间：

混合检索
rerank
LangGraph
多知识库
提示词版本管理
模型切换
流式输出
检索 trace 记录
14.3 大文档处理

长文档解析、切块、embedding 要考虑可分阶段执行，必要时后续改为异步任务，但第一版可以先同步实现。

15. 测试要求
15.1 至少保证 service 层可测

核心业务必须优先让 service 可独立测试。
不要把逻辑全部写进 controller。

15.2 优先覆盖以下场景

至少应覆盖：

注册/登录
创建会话
文档上传
文档入库状态流转
RAG 问答主链路
message 持久化
citation 映射
15.3 Mapper / Parser 可单测

复杂 mapper、parser、prompt builder 都应保持纯函数化倾向，方便单测。

16. 提交实现时的交付标准

任何新增后端功能在提交前都必须自检：

是否遵守 LangChain.js 优先原则
是否没有使用 any
是否模块分层清晰
是否 DTO、Schema、Service、Mapper 职责分明
是否支持必要的错误处理
是否考虑了用户隔离
是否返回前端所需结构，尤其是 citations / trace
是否没有把 prompt、AI 调用、数据库操作全部混在同一个函数里
是否具备基本可测试性
是否不破坏现有主链路
17. 明确禁止事项

以下做法默认禁止：

使用 any
在 controller 内写复杂业务逻辑
在多个模块中复制粘贴 prompt
在业务模块中直接零散调用模型
让 message 只存 content，不存 citations / trace
不校验资源归属直接读写 conversation/document/message
为了“快”而把所有类型写成宽泛对象
手写一大段 AI 流程却绕开 LangChain.js 现有能力
模块目录无分层，所有文件混放
先做复杂 agent，再补基础 RAG
18. 推荐的第一阶段后端模块

第一阶段默认优先建设以下模块：

auth
users
conversations
messages
documents
ingestion
rag

目标是形成最小可运行闭环：

用户登录
文档上传
文档入库
检索问答
结果落库
证据返回
19. AI 代理在本项目中的工作方式

如果 AI 代理参与代码生成，默认应遵循以下顺序：

先理解当前模块职责边界
优先补齐 DTO / interface / schema
再实现 service
最后接 controller
涉及 AI 能力时优先查找是否可用 LangChain.js 官方抽象
所有新增代码必须避免 any
所有返回结构必须为前端证据展示预留字段

AI 代理不应擅自：

重写项目整体架构
修改核心数据模型而不说明影响
引入与项目主栈冲突的新框架
把后端实现改成前端优先
用“临时代码”污染正式目录结构
20. 本文件优先级

当 AI 代理、自动补全建议、临时开发习惯与本文件冲突时，以本文件为准。
若后续项目演进导致规范调整，应直接更新本文件，而不是绕过本文件实现。

