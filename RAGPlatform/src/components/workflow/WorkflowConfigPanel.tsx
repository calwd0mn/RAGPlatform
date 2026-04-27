import { Empty, Form, Input, InputNumber, Typography } from "antd";
import type {
  WorkflowConditionItem,
  WorkflowNodeData,
} from "../../types/workflow";
import { useWorkflowEditorStore } from "../../stores/workflow-editor.store";
import { PageSectionCard } from "../common/PageSectionCard";
import styles from "./WorkflowEditorPanels.module.css";

function parseConditions(value: string): WorkflowConditionItem[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("条件必须是数组。");
  }
  return parsed.map((item): WorkflowConditionItem => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("条件项必须是对象。");
    }
    const record = item as Record<string, unknown>;
    if (
      typeof record.variable !== "string" ||
      typeof record.operator !== "string" ||
      !["===", "!==", ">", "<", ">=", "<=", "contains"].includes(
        record.operator,
      )
    ) {
      throw new Error("条件项格式不正确。");
    }
    const valueType = typeof record.value;
    if (!["string", "number", "boolean"].includes(valueType)) {
      throw new Error("条件值只支持 string、number 或 boolean。");
    }
    return {
      variable: record.variable,
      operator: record.operator as WorkflowConditionItem["operator"],
      value: record.value as WorkflowConditionItem["value"],
    };
  });
}

export function WorkflowConfigPanel() {
  const selectedNode = useWorkflowEditorStore(
    (state) =>
      state.flowNodes.find((node) => node.id === state.selectedNodeId) ?? null,
  );
  const updateNodeData = useWorkflowEditorStore(
    (state) => state.updateNodeData,
  );

  if (!selectedNode) {
    return (
      <PageSectionCard title="节点配置" className={styles.sideCard}>
        <Empty description="选择节点以编辑配置" />
      </PageSectionCard>
    );
  }

  const updateLabel = (label: string): void => {
    updateNodeData(selectedNode.id, {
      ...selectedNode.data,
      label,
    } as WorkflowNodeData);
  };

  const commonLabel = (
    <Form.Item label="节点名称">
      <Input
        value={selectedNode.data.label}
        onChange={(event) => updateLabel(event.target.value)}
      />
    </Form.Item>
  );

  const renderFields = () => {
    if (selectedNode.data.nodeType === "start") {
      return <Typography.Text type="secondary">工作流入口节点。</Typography.Text>;
    }
    if (selectedNode.data.nodeType === "userInput") {
      return (
        <Form.Item label="输入字段">
          <Input
            value={selectedNode.data.inputField}
            onChange={(event) =>
              updateNodeData(selectedNode.id, {
                ...selectedNode.data,
                inputField: event.target.value,
              })
            }
          />
        </Form.Item>
      );
    }
    if (selectedNode.data.nodeType === "rag") {
      return (
        <>
          <Form.Item label="检索查询">
            <Input.TextArea
              rows={4}
              value={selectedNode.data.query}
              onChange={(event) =>
                updateNodeData(selectedNode.id, {
                  ...selectedNode.data,
                  query: event.target.value,
                })
              }
            />
          </Form.Item>
          <Form.Item label="Top K">
            <InputNumber
              min={1}
              max={20}
              value={selectedNode.data.topK}
              onChange={(value) =>
                updateNodeData(selectedNode.id, {
                  ...selectedNode.data,
                  topK: value ?? 5,
                })
              }
            />
          </Form.Item>
        </>
      );
    }
    if (selectedNode.data.nodeType === "condition") {
      return (
        <Form.Item label="条件 JSON">
          <Input.TextArea
            rows={7}
            value={JSON.stringify(selectedNode.data.conditions, null, 2)}
            onChange={(event) => {
              try {
                updateNodeData(selectedNode.id, {
                  ...selectedNode.data,
                  conditions: parseConditions(event.target.value),
                });
              } catch {
                // Keep the previous valid condition set while the user edits.
              }
            }}
          />
        </Form.Item>
      );
    }
    return (
      <Form.Item label="输出问题模板">
        <Input.TextArea
          rows={5}
          value={selectedNode.data.outputValue}
          onChange={(event) =>
            updateNodeData(selectedNode.id, {
              ...selectedNode.data,
              outputValue: event.target.value,
            })
          }
        />
      </Form.Item>
    );
  };

  return (
    <PageSectionCard title="节点配置" className={styles.sideCard}>
      <Form layout="vertical" className={styles.configForm}>
        {commonLabel}
        {renderFields()}
      </Form>
    </PageSectionCard>
  );
}
