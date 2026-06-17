import { useEffect, useRef } from "react";
import type { UseMutationResult } from "@tanstack/react-query";
import { useToast } from "@/components/toast/ToastProvider";
import { TOAST_COMMAND } from "@/utils/toastMessages";

/** 무드등 제어 성공 시 「명령을 보냈습니다」 토스트 (낙관적 UI 없음) */
export function useMoodCommandSuccessToast<
  TData = unknown,
  TError = unknown,
  TVariables = unknown,
  TContext = unknown,
>(
  mutation: UseMutationResult<TData, TError, TVariables, TContext>,
) {
  const { showToast } = useToast();
  const lastSubmittedAtRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!mutation.isSuccess) {
      return;
    }
    if (mutation.submittedAt === lastSubmittedAtRef.current) {
      return;
    }
    lastSubmittedAtRef.current = mutation.submittedAt;
    showToast(TOAST_COMMAND.sent, { variant: "info", category: "control" });
  }, [mutation.isSuccess, mutation.submittedAt, showToast]);
}
