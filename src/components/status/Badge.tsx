import type { ReactNode } from "react";
import styles from "./Badge.module.css";

export type BadgeVariant = "ok" | "warn" | "danger" | "muted";

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  ok: styles.ok,
  warn: styles.warn,
  danger: styles.danger,
  muted: styles.muted,
};

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  title?: string;
}

export function Badge({ variant, children, title }: BadgeProps) {
  return (
    <span className={VARIANT_CLASS[variant]} title={title}>
      {children}
    </span>
  );
}
