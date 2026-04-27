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
            onDragStart={(event) => {
              event.dataTransfer.setData(
                "application/workflow-node",
                nodeType.type,
              );
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

