import type {
  ApiErrorDetail,
  ApiErrorPayload,
  ValidationErrorItem,
} from "./types";

export interface ParsedApiError {
  message: string;
  code?: string;
}

function isApiErrorDetail(v: unknown): v is ApiErrorDetail {
  return (
    typeof v === "object" &&
    v !== null &&
    "detail" in v &&
    typeof (v as ApiErrorDetail).detail === "string"
  );
}

function isValidationItem(v: unknown): v is ValidationErrorItem {
  return (
    typeof v === "object" &&
    v !== null &&
    "msg" in v &&
    typeof (v as ValidationErrorItem).msg === "string"
  );
}

export function parseApiErrorBody(text: string): ParsedApiError {
  try {
    const body = JSON.parse(text) as ApiErrorPayload;
    const d = body.detail;

    if (typeof d === "string") {
      return { message: d };
    }

    if (Array.isArray(d)) {
      const messages = d
        .filter(isValidationItem)
        .map((item) => item.msg)
        .filter(Boolean);
      return {
        message: messages.length > 0 ? messages.join("; ") : "요청 형식 오류",
      };
    }

    if (isApiErrorDetail(d)) {
      return { message: d.detail, code: d.code };
    }
  } catch {
    /* plain text */
  }

  return { message: text };
}
