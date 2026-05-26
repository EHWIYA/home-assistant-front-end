import type { BadgeVariant } from "@/components/status/Badge";

export function getAcAutoEnabledVariant(
  enabled: boolean | null | undefined,
): BadgeVariant {
  if (enabled === true) return "ok";
  if (enabled === false) return "muted";
  return "warn";
}
