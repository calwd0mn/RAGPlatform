import { Card, Typography } from "antd";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./PageSectionCard.module.css";

interface PageSectionCardProps extends PropsWithChildren {
  title: string;
  extra?: ReactNode;
}

export function PageSectionCard({ title, extra, children }: PageSectionCardProps) {
  return (
    <Card
      title={
        <Typography.Title level={5} className={styles.title}>
          {title}
        </Typography.Title>
      }
      extra={extra}
      className={styles.card}
      classNames={{ body: styles.body }}
    >
      <div className={styles.stack}>{children}</div>
    </Card>
  );
}
