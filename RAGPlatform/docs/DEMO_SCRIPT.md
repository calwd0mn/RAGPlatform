# DEMO_SCRIPT

## 演示目标

在 10~15 分钟内完整展示可交付闭环：

1. 登录/注册
2. 文档上传与 ingestion
3. /rag/ask 问答
4. citations / trace

## 演示前准备

1. 启动前后端服务。
2. 准备一份简短 txt/pdf 文档。
3. 准备一个新账号（避免历史数据干扰）。

## 演示步骤

### 1. 登录/注册（1 分钟）

- 打开 /login 或 /register。
- 完成注册后自动进入工作台。

### 2. 文档上传 + 入库（3 分钟）

- 进入 /app/documents。
- 上传文档，确认状态为 uploaded。
- 点击 开始入库，等待状态到 ready。

### 3. RAG 问答（3 分钟）

- 进入 /app/chat。
- 提问与文档相关的问题。
- 展示回答成功返回，并可继续多轮。

### 4. citations / trace（2 分钟）

- 在回答侧栏切换到证据与 trace。
- 演示：
  - citation 片段与文档来源
  - trace 的 topK / retrievedCount / provider / latency

## 演示收尾

- 强调本期冻结范围：仅交付主链路闭环。
- 说明延期项见 docs/KNOWN_ISSUES.md 与 DELIVERY_SCOPE.md。
