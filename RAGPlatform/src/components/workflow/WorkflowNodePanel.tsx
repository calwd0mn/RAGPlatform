import { PageSectionCard } from "../common/PageSectionCard";
import { WORKFLOW_NODE_CATALOG } from "./workflow-node-catalog";
import styles from "./WorkflowEditorPanels.module.css";

export function WorkflowNodePanel() {
  return (
    <PageSectionCard title="节点库" className={styles.sideCard}>
      <div className={styles.nodeList}>
        {WORKFLOW_NODE_CATALOG.map((nodeType) => (
          <button
            key={nodeType.type}
            className={styles.nodePaletteItem}
            draggable
            // web api原生Drag事件
            onDragStart={(event) => {
              // 写入自定义数据
              event.dataTransfer.setData(
                "application/workflow-node",
                nodeType.type,
              );
              // effectAllowed 指定拖动操作允许的效果，'copy'允许拖动元素复制到放置位置
              event.dataTransfer.effectAllowed = "copy";
            }}
          >
            <span className={styles.nodePaletteIcon}>{nodeType.icon}</span>
            <span>{nodeType.label}</span>
          </button>
        ))}
      </div>
    </PageSectionCard>
  );
}

