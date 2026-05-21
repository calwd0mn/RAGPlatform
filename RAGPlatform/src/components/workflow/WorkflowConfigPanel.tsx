import { Empty, Form, Input, InputNumber, Select, Typography } from "antd";
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
  const selectedNodeId = useWorkflowEditorStore(
    (state) => state.selectedNodeId,
  );
  const selectedNodeData = useWorkflowEditorStore(
    (state) =>
      state.flowNodes.find((node) => node.id === selectedNodeId)?.data ?? null,
  );
  const updateNodeData = useWorkflowEditorStore(
    (state) => state.updateNodeData,
  );

  if (!selectedNodeId || !selectedNodeData) {
    return (
      <PageSectionCard title="节点配置" className={styles.sideCard}>
        <Empty description="选择节点以编辑配置" />
      </PageSectionCard>
    );
  }

  const updateLabel = (label: string): void => {
    updateNodeData(selectedNodeId, {
      ...selectedNodeData,
      label,
    } as WorkflowNodeData);
  };

  const commonLabel = (
    <Form.Item label="节点名称">
      <Input
        value={selectedNodeData.label}
        onChange={(event) => updateLabel(event.target.value)}
      />
    </Form.Item>
  );

  const renderFields = () => {
    if (selectedNodeData.nodeType === "start") {
      return <Typography.Text type="secondary">工作流入口节点。</Typography.Text>;
    }
    if (selectedNodeData.nodeType === "userInput") {
      return (
        <Form.Item label="输入字段">
          <Input
            value={selectedNodeData.inputField}
            onChange={(event) =>
              updateNodeData(selectedNodeId, {
                ...selectedNodeData,
                inputField: event.target.value,
              })
            }
          />
        </Form.Item>
      );
    }
    if (selectedNodeData.nodeType === "rag") {
      return (
        <>
          <Form.Item label="检索查询">
            <Input.TextArea
              rows={4}
              value={selectedNodeData.query}
              onChange={(event) =>
                updateNodeData(selectedNodeId, {
                  ...selectedNodeData,
                  query: event.target.value,
                })
              }
            />
          </Form.Item>
          <Form.Item label="Top K">
            <InputNumber
              min={1}
              max={20}
              value={selectedNodeData.topK}
              onChange={(value) =>
                updateNodeData(selectedNodeId, {
                  ...selectedNodeData,
                  topK: Number(value ?? 5),
                })
              }
            />
          </Form.Item>
        </>
      );
    }
    if (selectedNodeData.nodeType === "llm") {
      return (
        <>
          <Form.Item label="System Prompt">
            <Input.TextArea
              rows={4}
              value={selectedNodeData.systemPrompt}
              onChange={(event) =>
                updateNodeData(selectedNodeId, {
                  ...selectedNodeData,
                  systemPrompt: event.target.value,
                })
              }
            />
          </Form.Item>
          <Form.Item label="User Prompt 模板">
            <Input.TextArea
              rows={6}
              value={selectedNodeData.userPromptTemplate}
              onChange={(event) =>
                updateNodeData(selectedNodeId, {
                  ...selectedNodeData,
                  userPromptTemplate: event.target.value,
                })
              }
            />
          </Form.Item>
          <Form.Item label="输出模式">
            <Select
              value={selectedNodeData.outputMode}
              options={[
                { label: "text", value: "text" },
                { label: "json", value: "json" },
              ]}
              onChange={(outputMode) => {
                updateNodeData(selectedNodeId, {
                  ...selectedNodeData,
                  outputMode,
                });
              }}
            />
          </Form.Item>
        </>
      );
    }
    if (selectedNodeData.nodeType === "queryRewrite") {
      return (
        <Form.Item label="原始问题模板">
          <Input.TextArea
            rows={4}
            value={selectedNodeData.query}
            onChange={(event) =>
              updateNodeData(selectedNodeId, {
                ...selectedNodeData,
                query: event.target.value,
              })
            }
          />
        </Form.Item>
      );
    }
    if (
      selectedNodeData.nodeType === "vectorRetrieve" ||
      selectedNodeData.nodeType === "bm25Retrieve" ||
      selectedNodeData.nodeType === "rerank"
    ) {
      return (
        <>
          <Form.Item label="检索查询">
            <Input.TextArea
              rows={4}
              value={selectedNodeData.query}
              onChange={(event) =>
                updateNodeData(selectedNodeId, {
                  ...selectedNodeData,
                  query: event.target.value,
                })
              }
            />
          </Form.Item>
          <Form.Item label="Top K">
            <InputNumber
              min={1}
              max={20}
              value={selectedNodeData.topK}
              onChange={(value) =>
                updateNodeData(selectedNodeId, {
                  ...selectedNodeData,
                  topK: Number(value ?? 5),
                })
              }
            />
          </Form.Item>
        </>
      );
    }
    if (selectedNodeData.nodeType === "mergeResults") {
      return (
        <Form.Item label="结果上限">
          <InputNumber
            min={1}
            max={50}
            value={selectedNodeData.resultLimit}
            onChange={(value) =>
              updateNodeData(selectedNodeId, {
                ...selectedNodeData,
                resultLimit: Number(value ?? 8),
              })
            }
          />
        </Form.Item>
      );
    }
    if (selectedNodeData.nodeType === "answer") {
      return (
        <Form.Item label="回答问题模板">
          <Input.TextArea
            rows={5}
            value={selectedNodeData.question}
            onChange={(event) =>
              updateNodeData(selectedNodeId, {
                ...selectedNodeData,
                question: event.target.value,
              })
            }
          />
        </Form.Item>
      );
    }
    if (selectedNodeData.nodeType === "condition") {
      return (
        <Form.Item label="条件 JSON">
          <Input.TextArea
            rows={7}
            value={JSON.stringify(selectedNodeData.conditions, null, 2)}
            onChange={(event) => {
              try {
                updateNodeData(selectedNodeId, {
                  ...selectedNodeData,
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
          value={selectedNodeData.outputValue}
          onChange={(event) =>
            updateNodeData(selectedNodeId, {
              ...selectedNodeData,
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
