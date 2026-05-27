import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./Toast.module.css";

export type ToastVariant = "info" | "warn" | "error";
export type ToastCategory = "control" | "query" | "sync";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ShowToastOptions {
  variant?: ToastVariant;
  category?: ToastCategory;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (message: string, options?: ShowToastOptions) => void;
}

const TOAST_DURATION_MS: Record<ToastVariant, number> = {
  info: 3200,
  warn: 4200,
  error: 5200,
};

const TOAST_CATEGORY_LABEL: Record<ToastCategory, string> = {
  control: "제어",
  query: "조회",
  sync: "동기화",
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);

  const showToast = useCallback((message: string, options?: ShowToastOptions) => {
    const variant = options?.variant ?? "info";
    const categoryLabel = options?.category ? TOAST_CATEGORY_LABEL[options.category] : null;
    const finalMessage = categoryLabel ? `[${categoryLabel}] ${message}` : message;
    const durationMs = options?.durationMs ?? TOAST_DURATION_MS[variant];

    const id = nextIdRef.current++;
    setItems((prev) => [...prev, { id, message: finalMessage, variant }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, durationMs);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.viewport} aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} className={`${styles.toast} ${styles[item.variant]}`} role="status">
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
