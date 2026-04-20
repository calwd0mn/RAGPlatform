import { Card, Typography } from "antd";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./PageSectionCard.module.css";

interface PageSectionCardProps extends PropsWithChildren {
  title: string;
  extra?: ReactNode;
  className?: string;
}

export function PageSectionCard({
  title,
  extra,
  className,
  children,
}: PageSectionCardProps) {
  return (
    <Card
      title={
        <Typography.Title level={5} className={styles.title}>
          {title}
        </Typography.Title>
      }
      extra={extra}
      className={[styles.card, className].filter((value): value is string => Boolean(value)).join(" ")}
      classNames={{ body: styles.body }}
    >
      <div className={styles.stack}>{children}</div>
    </Card>
  );
}
