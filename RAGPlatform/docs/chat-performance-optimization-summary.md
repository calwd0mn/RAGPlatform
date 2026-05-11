# Chat 页性能优化复盘

本文记录本轮针对 `/app/chat` 首屏性能的优化过程，包括问题发现、修改方案、验证方式、当前保留的优化点，以及尝试后回退或暂不继续的方向。

## 目标与测试方式

本轮优化的目标不是单纯让构建产物文件名更多或入口包更小，而是降低 `/app/chat` 的真实首屏成本，重点关注：

- FCP：First Contentful Paint
- LCP：Largest Contentful Paint
- TBT：Total Blocking Time
- Lighthouse 的“网络依赖关系树”
- Lighthouse 的“减少未使用 JavaScript”
- Chrome Performance 面板里的请求瀑布、主线程执行和 LCP 元素

测试方式主要是生产构建后预览：

```powershell
cd D:\Cdocument\desktop\QZH\a前端\Project-1\RAGPlatform\RAGPlatform
npm run build
npm run preview
```

然后访问：

```text
http://localhost:4173/app/chat
```

再使用 Chrome DevTools：

```text
Lighthouse -> Performance
Performance 面板录制
Network 面板观察 JS/API 请求
Coverage / Lighthouse 观察未使用 JS
```

构建包分析使用：

```powershell
npm run build:analyze
```

对应配置位于：

```text
@RAGPlatform/vite.config.ts
@RAGPlatform/package.json
```

## 当前测试结果

当前一次 Lighthouse 结果大致为：

```text
Performance: 94
FCP: 2.3s
LCP: 2.5s
TBT: 100ms
CLS: 0
Speed Index: 2.3s
```

这说明当前首屏已经进入比较健康的区间。继续优化仍然可以做，但已经进入收益递减阶段，需要更谨慎地评估维护成本和收益。

## 问题发现过程

### 1. 最初的入口包过大

早期 visualizer treemap 显示 `assets/index-*.js` 中混入了很多不属于 chat 首屏的依赖：

```text
@xyflow/react
d3-*
react-markdown
remark-gfm
unified / micromark
antd table / upload / tree
@rc-component/*
```

这说明当访问 `/app/chat` 时，workflow、documents、markdown 等非首屏模块也被主入口同步加载。

问题源头主要是路由文件同步 import 所有页面：

```text
@RAGPlatform/src/app/router/AppRouter.tsx
```

同步 import 会让 Rollup/Vite 把这些页面及其依赖放入同一个静态依赖图，导致 chat 首屏背上 workflow 和 documents 的包袱。

### 2. 分包不是万能解

曾尝试使用 `manualChunks` 把 React、Antd、Router、Data、Markdown、Workflow 等拆成 vendor chunk。

构建结果看起来更清晰：

```text
vendor-react
vendor-router
vendor-data
vendor-markdown
vendor-workflow
vendor-antd
```

但实际 FCP/LCP 变高。原因是：这些 vendor 仍然是 chat 首屏需要的依赖，拆出来没有减少首屏必须加载的 JS 总量，反而增加了请求数量、modulepreload 和模块协调成本。

因此最终没有保留粗粒度 `manualChunks` 方案。

结论：

```text
减少首屏加载量，要靠动态 import 改依赖边界；
manualChunks 更偏缓存和可视化，不等价于减少首屏执行成本。
```

### 3. 网络依赖树暴露接口阻塞

Lighthouse 的“网络依赖关系树”一度显示：

```text
/api/knowledge-bases
/api/conversations
/api/documents
/auth/profile
```

这些请求挂在初始导航之后，并影响 LCP。

后续优化重点从“继续拆 JS”转向：

```text
让 chat 空白首屏不等待非必要接口
让非核心数据延后加载
让 profile 不阻塞 ProtectedRoute 放行
```

### 4. LCP 详情定位具体元素

Lighthouse 的 LCP 详情曾指向状态条附近的 Antd 节点：

```text
div.ant-space-item
```

这说明后期瓶颈已经不是大块网络请求，而是首屏 Antd 组件树渲染和样式计算。于是又进一步轻量化了部分首屏常驻组件。

## 当前保留的优化点

### 1. 路由级代码分割

文件：

```text
@RAGPlatform/src/app/router/AppRouter.tsx
```

当前策略：

```text
ChatWorkbenchPage: 静态加载
DocumentsPage: lazy
WorkflowPage: lazy
LoginPage/RegisterPage: lazy
```

关键原因是 `/app/chat` 是默认首屏。如果 chat 本身也 lazy，会形成首屏 waterfall：

```text
加载 index
执行 router
发现需要 ChatWorkbenchPage
再请求 ChatWorkbenchPage chunk
再渲染 chat
```

所以最终没有让默认 chat 页 lazy，而是只 lazy 非首屏页面：

```tsx
import { lazy, Suspense } from "react";
import { ChatWorkbenchPage } from "../../pages/chat/ChatWorkbenchPage";

const DocumentsPage = lazy(() =>
  import("../../pages/documents/DocumentsPage").then((module) => ({
    default: module.DocumentsPage,
  })),
);

const WorkflowPage = lazy(() =>
  import("../../pages/workflow/WorkflowPage").then((module) => ({
    default: module.WorkflowPage,
  })),
);
```

收益：

```text
workflow 的 @xyflow/react / d3-* 不再进入 chat 首屏
documents 的 Table / Upload / Tree 不再进入 chat 首屏
避免 chat 自己 lazy 导致首屏多一次 chunk 请求
```

验证方式：

```text
npm run build
visualizer 查看 WorkflowPage / DocumentsPage 是否独立 chunk
Network 强刷 /app/chat，确认不首屏加载 WorkflowPage / DocumentsPage chunk
```

### 2. Markdown 渲染器懒加载

文件：

```text
@RAGPlatform/src/components/chat/AssistantMessageCard.tsx
@RAGPlatform/src/components/chat/MarkdownContent.tsx
```

发现问题：

`react-markdown` 和 `remark-gfm` 会带入一整套 markdown 解析链：

```text
react-markdown
remark-gfm
unified
micromark
mdast-util-*
hast-util-*
```

空白 `/app/chat` 首屏没有 assistant 消息，不需要加载 markdown。

修改方式：

把 markdown 依赖移入独立组件，并通过 `React.lazy` 加载：

```tsx
const MarkdownContent = lazy(() =>
  import("./MarkdownContent").then((module) => ({
    default: module.MarkdownContent,
  })),
);
```

`MarkdownContent` 内部才静态 import：

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
```

原理：

```text
静态 import:
ChatWorkbenchPage -> AssistantMessageCard -> react-markdown
打开 chat 就加载 markdown

动态 import:
ChatWorkbenchPage -> AssistantMessageCard -> import("./MarkdownContent")
只有渲染 assistant 消息时才加载 markdown
```

验证结果：

构建后出现独立 chunk：

```text
MarkdownContent-*.js
```

空白新会话首屏不应请求该 chunk。

### 3. 证据工作区按需加载

文件：

```text
@RAGPlatform/src/pages/chat/ChatWorkbenchPage.tsx
@RAGPlatform/src/components/citation/AssistantWorkspaceTabs.tsx
```

发现问题：

空白新会话时没有 assistant message，也没有 evidence/trace，但右侧工作区原本会同步进入 chat 包。

修改方式：

`AssistantWorkspaceTabs` 改为 lazy，并且只有存在 `activeAssistantMessage` 时才渲染：

```tsx
const AssistantWorkspaceTabs = lazy(() =>
  import("../../components/citation/AssistantWorkspaceTabs").then((module) => ({
    default: module.AssistantWorkspaceTabs,
  })),
);
```

渲染侧：

```tsx
{activeAssistantMessage ? (
  <Suspense fallback={...}>
    <AssistantWorkspaceTabs ... />
  </Suspense>
) : (
  <Typography.Text type="secondary">暂无证据内容</Typography.Text>
)}
```

收益：

```text
空白 chat 首屏不加载 EvidencePanel / TracePanel / Tabs
有回答后再加载证据工作区
```

验证结果：

构建后出现：

```text
AssistantWorkspaceTabs-*.js
AssistantWorkspaceTabs-*.css
```

### 4. 重命名弹窗和会话列表懒加载

文件：

```text
@RAGPlatform/src/pages/chat/ChatWorkbenchPage.tsx
@RAGPlatform/src/components/conversation/ConversationSidebar.tsx
@RAGPlatform/src/components/conversation/RenameConversationModal.tsx
@RAGPlatform/src/components/conversation/ConversationList.tsx
```

发现问题：

Lighthouse 的“减少未使用 JavaScript”中出现了：

```text
antd/es/menu/style
antd/es/pagination/style
@rc-component/form/es/hooks/useForm
```

这些主要来自：

```text
RenameConversationModal: Modal / Form / Input
ConversationList: List
ConversationActionsDropdown: Dropdown / Popconfirm / icons
```

这些都不是空白 chat 首屏必须出现的。

修改方式：

重命名弹窗只在真的打开时加载：

```tsx
const RenameConversationModal = lazy(() =>
  import("../../components/conversation/RenameConversationModal").then(
    (module) => ({
      default: module.RenameConversationModal,
    }),
  ),
);

{renameTargetConversation ? (
  <Suspense fallback={null}>
    <RenameConversationModal open ... />
  </Suspense>
) : null}
```

会话列表只在接口返回且有列表项时加载：

```tsx
const ConversationList = lazy(() =>
  import("./ConversationList").then((module) => ({
    default: module.ConversationList,
  })),
);
```

验证结果：

构建后出现独立 chunk：

```text
ConversationList-*.js
ConversationList-*.css
RenameConversationModal-*.js
useForm-*.js
DeleteOutlined-*.js
```

说明 Form、List、Dropdown、Popconfirm、部分图标已经移出空白 chat 首屏入口。

### 5. `/documents` 不再进入 chat 首屏关键路径

文件：

```text
@RAGPlatform/src/components/document/KnowledgeBaseStatusBar.tsx
```

发现问题：

状态条原本为了展示“可问答文档数量”直接调用 `useDocumentList()`，导致 `/app/chat` 首屏请求：

```text
/api/documents
```

这个统计对空白聊天首屏不是核心内容，却会占用网络和触发二次渲染。

当前处理：

状态条不再请求文档列表，只显示轻量文案：

```text
可直接开始提问，文档详情可前往文档页查看。
```

收益：

```text
/api/documents 从 /app/chat 首屏关键路径移除
文档数量统计放回文档页查看
```

注意：

曾尝试过 `requestIdleCallback` 延迟 `/documents`，但实际在 Lighthouse 中仍会过早触发，收益有限，因此改成 chat 状态条完全不请求 documents。

### 6. `/conversations` 延迟加载

文件：

```text
@RAGPlatform/src/hooks/chat/useConversationList.ts
@RAGPlatform/src/pages/chat/ChatWorkbenchPage.tsx
```

发现问题：

Lighthouse 网络依赖树中 `/api/conversations` 曾挂在 LCP 关键链上。

对于空白 `/app/chat`，历史会话列表不是首屏核心内容。首屏最重要的是：

```text
标题
输入框
空白消息区
页面布局稳定
```

修改方式：

`useConversationList` 增加 `enabled` 参数：

```ts
interface UseConversationListOptions {
  enabled?: boolean;
}

export function useConversationList(options: UseConversationListOptions = {}) {
  const { enabled = true } = options;

  return useQuery({
    ...
    enabled: enabled && knowledgeBaseId.length > 0,
  });
}
```

`ChatWorkbenchPage` 中区分：

```text
/app/chat
  延迟 2 秒后请求 conversations

/app/chat/:conversationId
  立即请求 conversations，用于校验当前会话
```

核心逻辑：

```tsx
const [shouldLoadConversationList, setShouldLoadConversationList] = useState(
  Boolean(conversationId),
);

useEffect(() => {
  if (conversationId) {
    setShouldLoadConversationList(true);
    return;
  }

  setShouldLoadConversationList(false);

  const timeoutId = window.setTimeout(() => {
    setShouldLoadConversationList(true);
  }, 2_000);

  return () => window.clearTimeout(timeoutId);
}, [conversationId, currentKnowledgeBaseId]);
```

收益：

```text
空白 /app/chat 不再让 /api/conversations 挂在 LCP 前
历史会话详情页仍能立即加载和校验
```

### 7. `/knowledge-bases` 按需加载，并缓存名称

文件：

```text
@RAGPlatform/src/components/knowledge-base/KnowledgeBaseSwitcher.tsx
@RAGPlatform/src/components/knowledge-base/KnowledgeBaseSelect.tsx
@RAGPlatform/src/stores/knowledge-base.store.ts
@RAGPlatform/src/constants/storage.ts
@RAGPlatform/src/pages/documents/DocumentsPage.tsx
```

发现问题：

顶部知识库切换器原本首屏调用 `useKnowledgeBaseList()`，导致：

```text
/api/knowledge-bases
```

进入 LCP 网络依赖链。

需要注意：Chrome DevTools 的“禁用缓存”禁用的是 HTTP cache，不会清空 `localStorage`。所以可以用 localStorage 缓存上次选择的知识库名称，避免首屏为了展示名称请求列表。

修改方式：

首屏只渲染一个轻量按钮，不加载完整 Select：

```tsx
{isSelecting ? (
  <Suspense fallback={<Button loading>{knowledgeBaseLabel}</Button>}>
    <KnowledgeBaseSelect onSelected={() => setIsSelecting(false)} />
  </Suspense>
) : (
  <Button onClick={() => setIsSelecting(true)}>
    {knowledgeBaseLabel}
  </Button>
)}
```

真正的列表请求挪到 `KnowledgeBaseSelect`：

```tsx
export function KnowledgeBaseSelect({ onSelected }: KnowledgeBaseSelectProps) {
  const knowledgeBaseListQuery = useKnowledgeBaseList();
  ...
}
```

store 增加缓存：

```ts
currentKnowledgeBaseId
currentKnowledgeBaseName
currentKnowledgeBaseIsDefault
```

并写入 localStorage：

```ts
localStorage.setItem(KNOWLEDGE_BASE_STORAGE_KEY, knowledgeBaseId);
localStorage.setItem(KNOWLEDGE_BASE_NAME_STORAGE_KEY, knowledgeBaseName);
localStorage.setItem(
  KNOWLEDGE_BASE_IS_DEFAULT_STORAGE_KEY,
  String(knowledgeBaseIsDefault),
);
```

文档页在选择、创建、重命名、删除知识库后同步更新缓存，避免回到 chat 时名称丢失。

收益：

```text
/api/knowledge-bases 不再因为 chat 首屏展示下拉框而请求
点击知识库按钮时才加载 Select 和知识库列表
禁用 HTTP cache 测试时仍可从 localStorage 显示名称
```

### 8. `/profile` 不再阻塞 ProtectedRoute 首屏放行

文件：

```text
@RAGPlatform/src/hooks/useAuth.ts
@RAGPlatform/src/app/router/ProtectedRoute.tsx
```

发现问题：

原逻辑：

```text
有 token
-> authStatus = loading
-> 请求 /profile
-> /profile 成功
-> authStatus = authenticated
-> ProtectedRoute 放行
-> 渲染 /app/chat
```

这意味着 `/profile` 是硬阻塞首屏的。

修改方式：

有 token 时乐观放行：

```ts
const [authStatus, setAuthStatus] = useState<
  "idle" | "loading" | "authenticated" | "unauthenticated"
>(() => (getAccessToken() ? "authenticated" : "unauthenticated"));
```

然后后台刷新 profile：

```ts
setAuthStatus("authenticated");
setCurrentUser((previousUser) =>
  previousUser ??
  ({
    id: "",
    username: getSavedUsername(),
    email: "",
  } satisfies AuthUser),
);

void queryClient
  .fetchQuery({
    queryKey: queryKeys.auth.profile,
    queryFn: fetchAndStoreCurrentUser,
    staleTime: 30_000,
  })
  .then((user) => {
    setCurrentUser(user);
    setAuthStatus("authenticated");
  })
  .catch(() => {
    // 401 responses are handled by the global unauthorized listener.
  });
```

401 仍由全局 unauthorized listener 处理：

```text
@RAGPlatform/src/services/http.ts
```

收益：

```text
有 token 时 /app/chat 可以先渲染
/profile 后台刷新用户信息
如果 token 失效，再跳回登录
```

取舍：

```text
token 过期时可能短暂看到应用壳，然后被踢回登录页
这是典型的“乐观认证渲染”取舍
```

### 9. AppLayout 导航轻量化

文件：

```text
@RAGPlatform/src/layouts/AppLayout.tsx
@RAGPlatform/src/layouts/AppLayout.module.css
```

发现问题：

`AppLayout` 原本使用 Antd `Tabs` 和多个 Ant Design 图标：

```text
Tabs
MessageOutlined
FileTextOutlined
NodeIndexOutlined
Space
```

对于三个固定导航项，这些能力偏重。

修改方式：

改为原生：

```tsx
<nav className={styles.nav} aria-label="主导航">
  {navigationItems.map((item) => (
    <button
      key={item.key}
      type="button"
      className={`${styles.navItem} ${
        activeTabKey === item.key ? styles.navItemActive : ""
      }`}
      aria-current={activeTabKey === item.key ? "page" : undefined}
      onClick={() => navigate(item.key)}
    >
      {item.label}
    </button>
  ))}
</nav>
```

收益：

```text
移除首屏 Tabs 运行时
移除导航图标
减少部分 rc-tabs / overflow / icons 相关依赖
```

### 10. PageSectionCard 轻量化

文件：

```text
@RAGPlatform/src/components/common/PageSectionCard.tsx
@RAGPlatform/src/components/common/PageSectionCard.module.css
```

发现问题：

`PageSectionCard` 在 chat 首屏出现多次，原本基于：

```text
Antd Card
Antd Typography.Title
```

LCP 详情曾指向 Antd wrapper 节点，因此继续减少首屏常驻 Antd 组件树。

修改方式：

改为原生：

```tsx
<section className={styles.card}>
  <header className={styles.header}>
    <h2 className={styles.title}>{title}</h2>
    {extra ? <div className={styles.extra}>{extra}</div> : null}
  </header>
  <div className={styles.body}>
    <div className={styles.stack}>{children}</div>
  </div>
</section>
```

收益：

```text
减少 Antd Card/Typography 首屏渲染成本
减少重复 card wrapper 的样式计算和组件执行
```

### 11. Google Fonts 移除

文件：

```text
@RAGPlatform/src/styles/theme.module.css
```

发现问题：

Lighthouse 曾提示 Google Fonts 渲染阻塞请求。

处理方式：

移除 Google Fonts `@import`，改用系统字体和中文字体 fallback。

收益：

```text
减少第三方字体 CSS 请求
避免字体请求影响首屏
```

## 当前不建议继续做的优化

### 1. 粗粒度 manualChunks

已经尝试过，实测 FCP/LCP 变高。

原因：

```text
如果依赖仍然是首屏必须加载，manualChunks 只是多拆了请求；
它不会减少首屏执行量，可能增加 waterfall 和模块调度成本。
```

因此当前不建议再用粗粒度 `vendor-antd`、`vendor-react` 之类强拆方式优化 chat 首屏。

### 2. 优先处理 2KB 级别 CSS render-blocking

当前 Lighthouse 仍可能提示：

```text
render-blocking CSS
index-*.css
约 2KB / 150ms
```

这个提示可以理解，但优先级不高：

```text
CSS 很小
CSS 阻塞渲染是正常机制
强行内联 critical CSS 会增加复杂度
收益不一定稳定
```

除非后续已经没有更大的 JS/API/组件渲染问题，否则暂不建议优先优化它。

### 3. 继续替换所有 Antd 组件

当前仍有一些首屏 Antd：

```text
AppLayout: Layout / Space / Avatar / Button / Typography
ChatWorkbenchPage: Row / Col / Typography / Alert
ConversationSidebar: Button / Input / Empty / Flex / Spin / Alert
ChatInputBox: Button / Input / Space
```

继续替换可以进一步降低入口 JS，但会明显增加 UI 维护成本。当前 Lighthouse Performance 已到 90+，建议先做功能回归，再决定是否继续。

## 验证清单

每次优化后至少执行：

```powershell
npm run build
```

如果要看包结构：

```powershell
npm run build:analyze
```

如果要测真实首屏：

```powershell
npm run preview
```

然后在 Chrome 中测试：

```text
http://localhost:4173/app/chat
```

建议检查：

- Network 首屏是否还有 `/api/documents`
- Network 首屏是否还有 `/api/knowledge-bases`
- `/api/conversations` 是否被延后到 LCP 之后
- `/auth/profile` 是否还阻塞路由渲染
- 空白 chat 是否不加载 `MarkdownContent-*.js`
- 空白 chat 是否不加载 `AssistantWorkspaceTabs-*.js`
- 空白 chat 是否不加载 `ConversationList-*.js`
- 点击知识库按钮后，是否才加载 `KnowledgeBaseSelect-*.js` 和 `/api/knowledge-bases`
- 点击会话列表重命名后，是否才加载 `RenameConversationModal-*.js`

功能回归场景：

- 访问 `/app/chat`，应显示空白新会话
- 点击“新建会话”，不应立即创建数据库会话
- 空白新会话发送第一条消息，应创建真实会话并流式回答
- 点击历史会话，能正常加载消息
- 删除当前会话，应回到 `/app/chat`
- 点击知识库按钮，应能打开下拉并切换知识库
- 文档页选择、创建、重命名、删除知识库后，chat 顶部缓存名称应同步
- token 有效时刷新 `/app/chat`，不应等待 `/profile` 后才渲染页面
- token 失效时，应被 401 listener 清理状态并跳回登录

## 当前结论

本轮优化的主线可以概括为：

```text
先用 visualizer 找出错误进入首屏的重依赖
再用 Lighthouse 网络依赖树找出阻塞 LCP 的接口
然后用 LCP 详情定位具体渲染元素
最后针对性拆动态 import、延后非核心接口、轻量化高频首屏组件
```

目前最有效的优化不是手动分包，而是：

```text
让首屏不加载不需要的页面
让首屏不请求不需要的接口
让首屏不渲染过重的组件树
```

当前性能已经达到较健康状态。后续如果继续追求更低 FCP/LCP，优先考虑：

```text
ChatWorkbenchPage Row/Col -> CSS grid
AppLayout 剩余 Antd 组件轻量化
ConversationSidebar / ChatInputBox 的首屏 Antd Input/Button 替换
正式性能测试时关闭 sourcemap
```

但这些都属于进一步打磨，不再是必须修复项。
