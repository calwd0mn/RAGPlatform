# 最终收口交付范围（2026-04-18）

## 本期已完成
- 账号体系：登录、注册、鉴权会话（JWT）。
- 文档链路：文档上传、文档列表/删除、入库（ingestion）。
- RAG 主链路：/rag/ask 问答、回答落库、会话消息持久化。
- 证据链：citations 与 trace 随回答返回并持久化。
- 调试链路：
  - prompt 调试：/rag/debug/prompt/current、/rag/debug/prompt/render
  - retrieval 调试：/rag/debug/retrieve、/rag/debug/runs、/rag/debug/runs/:runId
  - chunk 调试：/chunks/debug、/chunks/:chunkId/context
- 收口增强：
  - 调试接口最小访问限制（支持 RAG_DEBUG_ACCESS_TOKEN）
  - 最小 smoke e2e：覆盖注册、上传、ingestion、/rag/ask、prompt/chunk debug。

## 本期必须可用（验收口径）
- 登录/注册：可创建账号并获取可用 token。
- 文档上传：支持 txt/pdf，上传后文档状态可见。
- ingestion：可触发入库并进入 eady。
- RAG 问答：/rag/ask 返回 nswer/citations/trace。
- citations / trace：前端问答页可查看证据与 trace。
- prompt 调试：可查看当前 prompt 版本并执行 render。
- chunk 调试：可查询 chunk 列表并按 query/keyword 过滤。

## 本期不做（明确冻结）
- 回答体验增强（语气、改写策略、复杂后处理）。
- PDF 预览器。
- rerank / hybrid retrieval。
- 评测集与自动化评测平台。
- observability 后台（可视化监控面板）。
- LangGraph / memory / streaming 扩展能力。

## 延期事项（已确认）
- 调试工作台高级能力：参数快照对比、批量回放、实验管理。
- 生产级观测：调用链可视化、告警、SLO 看板。
- 复杂检索策略：多路召回、融合排序、离线评测回归。
