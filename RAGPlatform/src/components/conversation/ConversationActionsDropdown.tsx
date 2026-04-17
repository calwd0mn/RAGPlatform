import { DeleteOutlined, EditOutlined, MoreOutlined } from "@ant-design/icons";
import { Button, Dropdown, Flex, Popconfirm } from "antd";
import styles from "./ConversationActionsDropdown.module.css";

interface ConversationActionsDropdownProps {
  disabled?: boolean;
  onRename: () => void;
  onDelete: () => void;
}

export function ConversationActionsDropdown({
  disabled,
  onRename,
  onDelete,
}: ConversationActionsDropdownProps) {
  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      dropdownRender={() => (
        <Flex vertical className={styles.menu}>
          <Button
            type="text"
            icon={<EditOutlined />}
            className={styles.menuButton}
            onClick={(event) => {
              event.stopPropagation();
              onRename();
            }}
          >
            重命名
          </Button>
          <Popconfirm
            title="确认删除会话？"
            description="删除后不可恢复。"
            okText="删除"
            cancelText="取消"
            placement="left"
            onConfirm={(event) => {
              event?.stopPropagation();
              onDelete();
            }}
            onPopupClick={(event) => {
              event.stopPropagation();
            }}
          >
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              className={styles.menuButton}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              删除
            </Button>
          </Popconfirm>
        </Flex>
      )}
    >
      <Button
        type="text"
        icon={<MoreOutlined />}
        aria-label="会话操作"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
        }}
      />
    </Dropdown>
  );
}
