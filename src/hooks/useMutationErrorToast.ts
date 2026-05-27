import { useEffect, useRef } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { ToastCategory } from "@/components/toast/ToastProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { formatApiError } from "@/utils/apiMessages";

export function useMutationErrorToast<
  TData = unknown,
  TError = unknown,
  TVariables = unknown,
  TContext = unknown,
>(
  mutation: UseMutationResult<TData, TError, TVariables, TContext>,
  deviceLabel: string,
  actionGuide: string,
  category: ToastCategory = "control",
) {
  const { showToast } = useToast();
  const lastToastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mutation.isError) {
      lastToastMessageRef.current = null;
      return;
    }

    const fallbackMessage = `${deviceLabel} 제어 실패 — ${actionGuide}`;
    const apiMessage = formatApiError(mutation.error, fallbackMessage);
    const message =
      apiMessage === fallbackMessage
        ? fallbackMessage
        : `${deviceLabel} 제어 실패 — ${apiMessage}`;
    if (lastToastMessageRef.current === message) {
      return;
    }

    showToast(message, { variant: "error", category });
    lastToastMessageRef.current = message;
  }, [actionGuide, category, deviceLabel, mutation.error, mutation.isError, showToast]);
}
