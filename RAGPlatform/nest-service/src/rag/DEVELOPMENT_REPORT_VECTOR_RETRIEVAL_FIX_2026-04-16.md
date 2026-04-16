# 开发报告：向量检索正式化改造（二次修复版）

- 报告日期：2026-04-16
- 适用模块：ag
- 报告类型：增量修复报告（区别于既有 DEVELOPMENT_REPORT.md 的首版实现报告）

## 1. 背景与目标

在首版 向量检索正式化改造完成后，针对代码评审反馈，进行了第二轮修复，目标是：

1. 保留 retrieval 层的显式错误语义，避免在上层被统一吞并。
2. 让 trace 记录真实执行的 retrieval provider，而不是仅记录配置值。
3. 增强 Atlas provider 对返回 payload 的防御性校验。
4. 强化 atlas 模式下关键配置项的显式必填约束。

## 2. 本轮修复范围

本轮仅修改 retrieval 与 rag 集成相关代码，不扩展到 rerank / hybrid / prompt 重构 / streaming / LangGraph。

## 3. 关键修复说明

### 3.1 Retrieval 显式错误透传

- 问题：RagService 会将 retrieval 相关异常统一包装为固定文案，导致 atlas 配置错误、provider 不可用等关键信息丢失。
- 修复：在 RagService 中仅对非 HttpException 做兜底包装；对 retrieval 层抛出的 HttpException 直接透传。

影响：满足atlas 不可用需显式报错的约束，便于联调与排障。

### 3.2 Trace 记录实际执行 Provider

- 问题：trace 的 etrievalProvider 之前记录的是配置 provider，在 atlas 失败且允许 fallback 时会产生误导。
- 修复：新增 retrieval 输出结构 RagRetrievalOutput，由 retrieval 层返回：
  - chunks
  - provider（本次实际执行值，tlas 或 local）

RagService 改为调用 etrieveTopKByUserWithProvider 并写入真实 provider 到 trace。

### 3.3 Atlas Payload 防御性校验

- 问题：Atlas 聚合结果若字段缺失，可能出现运行时错误或异常语义不清。
- 修复：
  1. 增加行级结构校验 isValidAtlasRow。
  2. 对归属于当前用户但结构不合法的 row 显式抛错：Atlas provider returned invalid payload。
  3. 保持 userId 二次防御过滤（检索 filter + 结果层校验）。

### 3.4 Atlas 必填配置强化

- 问题：此前 atlas 配置检查可能被默认值掩盖。
- 修复：
  - RAG_RETRIEVAL_PROVIDER=atlas 时，必须显式提供：
    - RAG_VECTOR_INDEX_NAME
    - RAG_VECTOR_PATH
  - 缺失时直接抛明确错误。

## 4. 新增/修改文件

### 新增

- src/rag/retrievers/interfaces/rag-retrieval-output.interface.ts
- src/rag/retrievers/config/rag-retrieval.config.spec.ts

### 修改

- src/rag/rag.service.ts
- src/rag/rag.service.spec.ts
- src/rag/retrievers/rag-retrieval.service.ts
- src/rag/retrievers/providers/atlas-vector-retrieval.provider.ts
- src/rag/retrievers/providers/atlas-vector-retrieval.provider.spec.ts
- src/rag/retrievers/rag-retrieval.service.spec.ts
- src/rag/retrievers/config/rag-retrieval.config.ts

## 5. 测试与验证

本轮执行并通过：

1. 
pm run test -- --runInBand src/rag/retrievers/config/rag-retrieval.config.spec.ts src/rag/retrievers/rag-retrieval.service.spec.ts src/rag/retrievers/providers/atlas-vector-retrieval.provider.spec.ts src/rag/retrievers/providers/local-cosine-retrieval.provider.spec.ts src/rag/rag.service.spec.ts src/rag/rag.controller.spec.ts
2. 
pm run build

结果：

- Test Suites: 6 passed
- Tests: 21 passed
- Build: success

## 6. 行为一致性说明

- POST /rag/ask 主流程保持兼容（embedding -> retrieval -> prompt -> generate -> citations/trace -> 持久化）。
- citations / message persistence 行为未改语义。
- trace 增强项 etrievalProvider 语义由配置值升级为实际执行值。

## 7. 已知后续可优化项（未纳入本次改造）

- RagRetrievalService#getConfiguredProvider() 当前已无调用点，可在后续小版本中清理。
- 若后续接入更多向量后端，可继续沿用当前 provider 输出结构，不需要改动 RagService 主链路。

## 8. 结论

本轮修复已覆盖评审指出的关键风险点，并通过单测与构建验证。retrieval 层的可替换性、错误可观测性、以及多用户隔离防御均得到增强，且未扩大改造边界。
