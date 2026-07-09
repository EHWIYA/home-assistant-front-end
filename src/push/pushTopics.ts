import type { AcPushAlert } from "./alertTypes";

export type PushTopicCategory = "ac" | "pc" | "strip" | "general";

export interface PushTopicMeta {
  category: PushTopicCategory;
  label: string;
  accent: string;
}

const TOPIC_META: Record<string, PushTopicMeta> = {
  ac: { category: "ac", label: "에어컨", accent: "#5b9fd4" },
  "ac-anomaly": { category: "ac", label: "에어컨", accent: "#5b9fd4" },
  pc: { category: "pc", label: "PC", accent: "#9c7bd8" },
  "pc-offline": { category: "pc", label: "PC", accent: "#9c7bd8" },
  strip: { category: "strip", label: "멀티탭", accent: "#e8b84a" },
  multitab: { category: "strip", label: "멀티탭", accent: "#e8b84a" },
};

export function getPushTopicMeta(alert: Pick<AcPushAlert, "topic" | "llmEscalate">): PushTopicMeta {
  const topic = alert.topic?.trim().toLowerCase();
  if (topic && TOPIC_META[topic]) {
    return TOPIC_META[topic];
  }

  if (alert.llmEscalate?.trim().toLowerCase() === "true") {
    return { category: "ac", label: "에어컨 · LLM", accent: "#e07a5f" };
  }

  return { category: "ac", label: "에어컨", accent: "#5b9fd4" };
}

export function isAcPushAlert(alert: Pick<AcPushAlert, "topic">): boolean {
  const category = getPushTopicMeta(alert).category;
  return category === "ac";
}
