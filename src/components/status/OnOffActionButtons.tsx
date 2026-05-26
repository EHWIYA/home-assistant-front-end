import { Button } from "@/components/Button";
import type { OnOffAction } from "@/api/types";
import shared from "./statusPage.module.css";

interface OnOffActionButtonsProps {
  disabled?: boolean;
  isPending: boolean;
  pendingAction?: OnOffAction;
  onOn: () => void;
  onOff: () => void;
  error?: boolean;
}

/** AC·PC 공통 켜기/끄기 버튼 쌍 (DRY, 단일 책임). */
export function OnOffActionButtons({
  disabled = false,
  isPending,
  pendingAction,
  onOn,
  onOff,
  error = false,
}: OnOffActionButtonsProps) {
  return (
    <>
      <div className={shared.actions}>
        <Button
          fullWidth
          variant="primary"
          disabled={disabled || isPending}
          onClick={onOn}
        >
          {isPending && pendingAction === "on" ? "처리 중…" : "켜기"}
        </Button>
        <Button
          fullWidth
          variant="danger"
          disabled={disabled || isPending}
          onClick={onOff}
        >
          {isPending && pendingAction === "off" ? "처리 중…" : "끄기"}
        </Button>
      </div>
      {error ? (
        <p className={shared.errorDetail}>제어 실패 — 다시 시도해 주세요.</p>
      ) : null}
    </>
  );
}
