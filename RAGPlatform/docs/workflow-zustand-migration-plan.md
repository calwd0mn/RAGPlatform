# Workflow 画布状态迁移到 Zustand 计划

## 目标

参考隔壁 `aiflow-studio` 的 Zustand 工作流状态管理思路，把当前 `WorkflowPage` 中的画布状态、选中节点、运行状态迁移到独立 Zustand store。

这次迁移的重点不是“为了用 Zustand 而用 Zustand”，而是：

- 降低 `WorkflowPage.tsx` 的状态协调复杂度。
- 让画布、配置面板、调试面板各自订阅自己需要的状态。
- 把节点配置状态和运行状态分离。
- 避免每次节点运行状态变化时都更新整个 `flowNodes` 数组。
- 为后续自动保存、撤销/重做、多工作流、快捷键等能力打基础。

## 当前问题

当前 `WorkflowPage` 里仍然管理了这些状态：

- `flowNodes`
- `flowEdges`
- `selectedNodeId`
- `executions`
- `finalResult`

并且运行状态通过 `node.data.executionStatus` 写回节点数据。

问题是：

- 页面组件仍然承担太多状态协调职责。
- 调试运行时每个 `node_status` 都会 map 一遍 `flowNodes`。
- 节点配置数据和运行态混在一起。
- 后续新增功能时，配置面板、画布、调试面板之间会继续加 props。
- 节点组件无法只订阅自己的运行状态。

## 新增 Store

新增文件：

`@src/stores/workflow-editor.store.ts`

Store 只负责前端编辑器状态，不负责请求。

请求仍然由 React Query 和服务层负责：

- `getCurrentWorkflow`
- `updateWorkflow`
- `runWorkflowStream`

## Store 状态设计

```ts
interface WorkflowEditorState {
  workflowId: string;
  knowledgeBaseId: string;

  flowNodes: WorkflowFlowNode[];
  flowEdges: Edge[];

  selectedNodeId: string;
  executionStates: Record<string, WorkflowNodeExecution>;
  finalResult: WorkflowRunFinal | null;

  setWorkflow: (workflow: WorkflowRecord) => void;
  resetWorkflow: () => void;

  setFlowNodes: (nodes: WorkflowFlowNode[]) => void;
  setFlowEdges: (edges: Edge[]) => void;

  applyWorkflowNodeChanges: (changes: NodeChange<WorkflowFlowNode>[]) => void;
  applyWorkflowEdgeChanges: (changes: EdgeChange<Edge>[]) => void;
  connectNodes: (connection: Connection) => void;
  addNode: (node: WorkflowFlowNode) => void;

  selectNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: WorkflowNodeData) => void;

  setNodeExecution: (execution: WorkflowNodeExecution) => void;
  setFinalResult: (result: WorkflowRunFinal) => void;
  clearRunState: () => void;
}
```

## 关键原则

### 1. 请求逻辑不进 Zustand

Zustand 不负责：

- 拉取 workflow
- 保存 workflow
- 调用调试运行接口
- 管理 React Query cache

这些继续留在：

- `WorkflowPage`
- `WorkflowRunPanel`
- `@src/services/workflows.ts`

原因：

- 当前项目已经用 React Query 管服务端状态。
- Zustand 只管理客户端编辑器状态更清晰。
- 避免 store 同时承担 server state 和 client state。

### 2. 不存 selectedNode 对象

Store 只存：

```ts
selectedNodeId: string
```

不存：

```ts
selectedNode: WorkflowFlowNode | null
```

原因：

- 如果节点数据更新，存下来的 selectedNode 对象容易变旧。
- 配置面板可以用 selector 从 `flowNodes + selectedNodeId` 派生当前选中节点。

### 3. 运行态不写进 node.data

当前做法：

```ts
node.data.executionStatus = "running"
```

迁移后改成：

```ts
executionStates[nodeId] = {
  nodeId,
  status,
  output,
  error,
}
```

节点组件通过自己的 `id` 订阅运行态：

```ts
const executionStatus = useWorkflowEditorStore(
  (state) => state.executionStates[id]?.status,
);
```

好处：

- 节点配置数据保持纯净。
- 调试运行不会污染待保存的 workflow nodes。
- 每次节点状态变化不再 map 整个 `flowNodes`。
- 后续保存时不需要剥离 `executionStatus`。

### 4. AbortController 不进 Store

`AbortController` 仍然留在 `WorkflowRunPanel` 内部。

原因：

- 它只属于一次运行请求生命周期。
- 放入全局 store 会引入不可序列化状态。
- 不利于清理和复用。

## 组件订阅设计

### WorkflowPage

迁移后 `WorkflowPage` 只负责：

- 根据当前知识库拉取 workflow。
- 拉取成功后调用 `setWorkflow(workflow)`。
- 点击保存时从 store 读取 `flowNodes/flowEdges` 并提交。
- 处理加载、错误、空知识库状态。
- 搭页面框架。

订阅内容：

```ts
const workflowId = useWorkflowEditorStore((state) => state.workflowId);
const flowNodes = useWorkflowEditorStore((state) => state.flowNodes);
const flowEdges = useWorkflowEditorStore((state) => state.flowEdges);
const setWorkflow = useWorkflowEditorStore((state) => state.setWorkflow);
const resetWorkflow = useWorkflowEditorStore((state) => state.resetWorkflow);
```

保存时使用：

```ts
const nodes = toWorkflowNodes(useWorkflowEditorStore.getState().flowNodes);
const edges = toWorkflowEdges(useWorkflowEditorStore.getState().flowEdges);
```

### WorkflowCanvasSurface

迁移后可以不再从父组件接收大堆 props，而是直接订阅 store。

订阅内容：

```ts
const flowNodes = useWorkflowEditorStore((state) => state.flowNodes);
const flowEdges = useWorkflowEditorStore((state) => state.flowEdges);
const applyWorkflowNodeChanges = useWorkflowEditorStore(
  (state) => state.applyWorkflowNodeChanges,
);
const applyWorkflowEdgeChanges = useWorkflowEditorStore(
  (state) => state.applyWorkflowEdgeChanges,
);
const connectNodes = useWorkflowEditorStore((state) => state.connectNodes);
const selectNode = useWorkflowEditorStore((state) => state.selectNode);
const addNode = useWorkflowEditorStore((state) => state.addNode);
```

这样 `WorkflowPage` 不再需要传：

- `flowNodes`
- `flowEdges`
- `onNodesChange`
- `onEdgesChange`
- `onConnect`
- `onSelectNode`
- `onAddNode`

### WorkflowConfigPanel

迁移后配置面板订阅：

```ts
const selectedNodeId = useWorkflowEditorStore((state) => state.selectedNodeId);
const selectedNode = useWorkflowEditorStore((state) =>
  state.flowNodes.find((node) => node.id === state.selectedNodeId) ?? null,
);
const updateNodeData = useWorkflowEditorStore((state) => state.updateNodeData);
```

注意：

- 可以先这样写。
- 如果担心 selector 返回对象导致重渲染，再拆成更细 selector 或使用 shallow。
- 当前节点数量较少，先保持简单。

### WorkflowRunPanel

迁移后调试面板订阅：

```ts
const workflowId = useWorkflowEditorStore((state) => state.workflowId);
const executionStates = useWorkflowEditorStore((state) => state.executionStates);
const finalResult = useWorkflowEditorStore((state) => state.finalResult);
const setNodeExecution = useWorkflowEditorStore((state) => state.setNodeExecution);
const setFinalResult = useWorkflowEditorStore((state) => state.setFinalResult);
const clearRunState = useWorkflowEditorStore((state) => state.clearRunState);
```

SSE 回调逻辑：

```ts
if (event.event === "node_status") {
  setNodeExecution(event.data);
}

if (event.event === "final") {
  setFinalResult(event.data);
}
```

### WorkflowNodes

迁移前：

```ts
status={data.executionStatus}
```

迁移后：

```ts
const status = useWorkflowEditorStore(
  (state) => state.executionStates[id]?.status,
);
```

然后传给 `NodeShell`。

节点组件仍然通过 `data` 读取节点配置：

- label
- inputField
- topK
- nodeType

运行态从 store 读取：

- running
- success
- failed
- skipped

## Store Action 细节

### setWorkflow

负责把后端 workflow 转成 React Flow 可用状态。

```ts
setWorkflow: (workflow) =>
  set({
    workflowId: workflow.id,
    knowledgeBaseId: workflow.knowledgeBaseId,
    flowNodes: toFlowNodes(workflow.nodes),
    flowEdges: toFlowEdges(workflow.edges),
    selectedNodeId: "",
    executionStates: {},
    finalResult: null,
  })
```

### resetWorkflow

用于切换知识库、未选知识库、拉取失败时清空编辑器。

```ts
resetWorkflow: () =>
  set({
    workflowId: "",
    knowledgeBaseId: "",
    flowNodes: [],
    flowEdges: [],
    selectedNodeId: "",
    executionStates: {},
    finalResult: null,
  })
```

### applyWorkflowNodeChanges

把 React Flow 的节点变更放进 store。

```ts
applyWorkflowNodeChanges: (changes) =>
  set((state) => ({
    flowNodes: applyNodeChanges(changes, state.flowNodes) as WorkflowFlowNode[],
  }))
```

### applyWorkflowEdgeChanges

```ts
applyWorkflowEdgeChanges: (changes) =>
  set((state) => ({
    flowEdges: applyEdgeChanges(changes, state.flowEdges),
  }))
```

### connectNodes

```ts
connectNodes: (connection) =>
  set((state) => ({
    flowEdges: addEdge(
      {
        ...connection,
        id: `${connection.source}-${connection.target}-${Date.now()}`,
      },
      state.flowEdges,
    ),
  }))
```

### addNode

```ts
addNode: (node) =>
  set((state) => ({
    flowNodes: [...state.flowNodes, node],
  }))
```

### updateNodeData

```ts
updateNodeData: (nodeId, data) =>
  set((state) => ({
    flowNodes: state.flowNodes.map((node) =>
      node.id === nodeId ? { ...node, data } : node,
    ),
  }))
```

不再保留：

```ts
executionStatus: node.data.executionStatus
```

因为运行态已经独立出去。

### clearRunState

```ts
clearRunState: () =>
  set({
    executionStates: {},
    finalResult: null,
  })
```

不再 map `flowNodes`。

### setNodeExecution

```ts
setNodeExecution: (execution) =>
  set((state) => ({
    executionStates: {
      ...state.executionStates,
      [execution.nodeId]: execution,
    },
  }))
```

### setFinalResult

```ts
setFinalResult: (result) =>
  set({ finalResult: result })
```

## 文件改动范围

### 新增

`@src/stores/workflow-editor.store.ts`

### 修改

`@src/pages/workflow/WorkflowPage.tsx`

- 移除大部分 local state。
- 拉取成功后调用 store 的 `setWorkflow`。
- 保存时从 store 读取 nodes/edges。
- 保留 React Query 和页面状态处理。

`@src/components/workflow/WorkflowCanvasSurface.tsx`

- 不再接收 nodes/edges/change handlers。
- 直接订阅 Zustand store。

`@src/components/workflow/WorkflowConfigPanel.tsx`

- 不再接收 `selectedNode` 和 `onUpdateNodeData`。
- 通过 store 派生 selectedNode。
- 调用 store action 更新节点配置。

`@src/components/workflow/WorkflowRunPanel.tsx`

- 不再接收 `workflowId/executions/finalResult/onRunEvent/onClear`。
- 从 store 读取调试状态。
- SSE 回调直接写 store。

`@src/components/workflow/WorkflowNodes.tsx`

- 移除 `data.executionStatus` 类型。
- 每个节点组件通过 `id` 从 store 读取自己的状态。

`@src/components/workflow/workflow-graph-adapters.ts`

- `toWorkflowNodes` 不再需要剥离 `executionStatus`。
- 因为 node.data 不再包含运行态。

## 迁移顺序

### Step 1：新增 Store

新增 `workflow-editor.store.ts`。

先实现：

- state
- `setWorkflow`
- `resetWorkflow`
- nodes/edges actions
- selection actions
- run state actions

此步不改 UI 行为。

### Step 2：迁移 WorkflowPage

把 `WorkflowPage` 中这些 local state 移除：

- `flowNodes`
- `flowEdges`
- `selectedNodeId`
- `executions`
- `finalResult`

改用 store。

### Step 3：迁移 Canvas

`WorkflowCanvasSurface` 直接订阅：

- `flowNodes`
- `flowEdges`
- `applyWorkflowNodeChanges`
- `applyWorkflowEdgeChanges`
- `connectNodes`
- `selectNode`
- `addNode`

父组件不再传相关 props。

### Step 4：迁移 ConfigPanel

`WorkflowConfigPanel` 从 store 派生选中节点。

删除 props：

```ts
selectedNode
onUpdateNodeData
```

### Step 5：迁移 RunPanel

`WorkflowRunPanel` 从 store 读取：

- `workflowId`
- `executionStates`
- `finalResult`

SSE 事件直接写 store。

### Step 6：迁移节点运行态订阅

修改 `WorkflowNodes.tsx`：

- 删除 `executionStatus` from data。
- `NodeShell` status 来自 store。
- 每个节点按 `id` 订阅自己的状态。

### Step 7：清理类型和 adapter

清理：

- `WorkflowNodeData & { executionStatus?: ... }`
- `toWorkflowNodes` 中剥离 executionStatus 的逻辑
- 页面中传递调试状态的 props

## 验证计划

### 构建检查

运行：

```bash
npm run build
```

后端不涉及本次迁移，但可以保留一次类型检查：

```bash
cd nest-service
npx tsc -p tsconfig.build.json --noEmit
```

### 代码约束

检查新增和修改文件没有 `any`：

```bash
rg '\bany\b' src/stores/workflow-editor.store.ts src/pages/workflow src/components/workflow
```

### 手动验证

1. 进入 `/app/workflow`。
2. 默认工作流正常加载。
3. 拖拽新增节点，画布正常更新。
4. 移动节点，保存后刷新位置仍在。
5. 点击节点，右侧配置面板显示对应配置。
6. 修改节点名称、RAG query、Top K、输出模板后画布同步更新。
7. 点击运行，节点状态正常变化。
8. 运行状态变化时不污染节点配置。
9. 保存后后端 payload 中不包含 `executionStatus`。
10. 清除调试结果后节点状态清空，节点配置不变。

## 风险点

### 1. Selector 返回对象导致额外重渲染

例如：

```ts
const selectedNode = useWorkflowEditorStore((state) =>
  state.flowNodes.find((node) => node.id === state.selectedNodeId) ?? null,
);
```

短期可以接受。

如果后续节点数量明显增加，再优化为：

- 拆 selector
- 使用 `useShallow`
- 或建立 `nodeById` 派生结构

### 2. React Flow nodes 数组变化仍会触发画布更新

Zustand 不会消除 React Flow 自身的更新成本。

本次真正减少的是：

- 运行状态变化不再改 `flowNodes`
- 节点组件按 id 订阅运行态

### 3. Store action 命名冲突

不要让 store action 和 React Flow 工具函数同名。

推荐：

- `applyWorkflowNodeChanges`
- `applyWorkflowEdgeChanges`

而不是：

- `applyNodeChanges`
- `applyEdgeChanges`

### 4. 请求状态不要混入 store

不要把 `isLoading`、`isSaving` 放进 store。

这些继续归 React Query mutation/query 管。

## 完成后的预期结构

```txt
src/
  stores/
    workflow-editor.store.ts

  components/
    workflow/
      WorkflowCanvasSurface.tsx
      WorkflowConfigPanel.tsx
      WorkflowNodePanel.tsx
      WorkflowRunPanel.tsx
      WorkflowNodes.tsx
      WorkflowEditorPanels.module.css
      workflow-node-catalog.tsx
      workflow-graph-adapters.ts

  pages/
    workflow/
      WorkflowPage.tsx
      WorkflowPage.module.css
```

## 最终效果

迁移后：

- `WorkflowPage.tsx` 更薄，只管页面级数据流。
- 画布、配置、调试不再靠层层 props 传递。
- 节点运行状态从节点配置中剥离。
- 调试 SSE 更新不会再 map 整个 nodes 数组。
- 节点组件能独立订阅自己的运行状态。
- 后续自动保存、撤销/重做、多工作流、快捷键更容易扩展。
