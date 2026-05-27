import { useEffect, useRef } from "react";
import type { ToastVariant } from "@/components/toast/ToastProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { formatApiError } from "@/utils/apiMessages";

interface UseQueryErrorToastParams {
  isError: boolean;
  error: unknown;
  resourceLabel: string;
  actionGuide: string;
  variant?: ToastVariant;
}

export function useQueryErrorToast({
  isError,
  error,
  resourceLabel,
  actionGuide,
  variant = "warn",
}: UseQueryErrorToastParams) {
  const { showToast } = useToast();
  const lastToastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isError) {
      lastToastMessageRef.current = null;
      return;
    }

    const fallbackMessage = `${resourceLabel} 조회 실패 — ${actionGuide}`;
    const apiMessage = formatApiError(error, fallbackMessage);
    const message =
      apiMessage === fallbackMessage
        ? fallbackMessage
        : `${resourceLabel} 조회 실패 — ${apiMessage}`;

    if (lastToastMessageRef.current === message) {
      return;
    }

    showToast(message, { variant, category: "query" });
    lastToastMessageRef.current = message;
  }, [actionGuide, error, isError, resourceLabel, showToast, variant]);
}
