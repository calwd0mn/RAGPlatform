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
    <section
      className={[styles.card, className]
        .filter((value): value is string => Boolean(value))
        .join(" ")}
    >
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {extra ? <div className={styles.extra}>{extra}</div> : null}
      </header>
      <div className={styles.body}>
        <div className={styles.stack}>{children}</div>
      </div>
    </section>
  );
}
