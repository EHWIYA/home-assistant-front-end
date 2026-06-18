import type {
  SchedulePreviewOccurrence,
  SchedulePreviewSlot,
} from "@/api/types";

const KST = "Asia/Seoul";

/** `at_kst` ISO 8601 (+09:00) → `YYYY-MM-DD` (KST 기준) */
export function atKstToDateYmd(atKst: string): string {
  const head = /^(\d{4}-\d{2}-\d{2})T/.exec(atKst);
  if (head) return head[1];

  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: KST }).format(
      new Date(atKst),
    );
  } catch {
    return atKst.slice(0, 10);
  }
}

/** `at_kst` → `HH:MM` (KST 시·분) */
export function atKstToTimeHm(atKst: string): string {
  const inline = /T(\d{2}):(\d{2})/.exec(atKst);
  if (inline) return `${inline[1]}:${inline[2]}`;

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: KST,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date(atKst));
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${hour}:${minute}`;
  } catch {
    return "00:00";
  }
}

export function previewSlotToOccurrence(
  slot: SchedulePreviewSlot,
): SchedulePreviewOccurrence {
  return {
    schedule_id: slot.schedule_id,
    name: slot.schedule_name,
    time_kst: atKstToTimeHm(slot.at_kst),
    action_type: slot.action_type,
    channel_number: slot.channel_number,
    preset_name: slot.preset_name,
  };
}

export function groupPreviewSlotsByDate(
  slots: readonly SchedulePreviewSlot[],
): Map<string, SchedulePreviewOccurrence[]> {
  const map = new Map<string, SchedulePreviewOccurrence[]>();

  for (const slot of slots) {
    const date = atKstToDateYmd(slot.at_kst);
    const list = map.get(date) ?? [];
    list.push(previewSlotToOccurrence(slot));
    map.set(date, list);
  }

  return map;
}
