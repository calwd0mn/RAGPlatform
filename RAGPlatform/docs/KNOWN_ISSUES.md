# KNOWN_ISSUES

## 已知问题与风险（收口版）

1. RAG 质量受 embedding/model/文档内容影响较大。

- 本期目标是可交付主链路，不包含回答体验增强与评测体系。

2. 仅提供最小 smoke e2e。

- 已覆盖主链路可用性。
- 尚未覆盖复杂长文、极端并发、回归评测集。

3. 文档侧仅保证上传/入库/删除与检索闭环。

- 不包含 PDF 预览器与高级文档运营能力。

## 明确延期

- rerank / hybrid retrieval
- 回答体验增强
- 评测集与自动评测
- observability 后台
- LangGraph / memory / streaming 扩展
