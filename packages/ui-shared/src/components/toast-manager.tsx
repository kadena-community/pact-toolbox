import { createSignal, For, createContext, useContext, JSX, Component } from "solid-js";
import { Portal } from "solid-js/web";
import { PactToast, ToastVariant, ToastPosition } from "./toast";

interface ToastItem {
  id: string;
  variant?: ToastVariant;
  title?: string;
  message: string;
  duration?: number;
  position?: ToastPosition;
  actions?: JSX.Element;
}

interface ToastContextType {
  showToast: (toast: Omit<ToastItem, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

interface ToastProviderProps {
  children: JSX.Element;
}

export const ToastProvider: Component<ToastProviderProps> = (props) => {
  const [toasts, setToasts] = createSignal<ToastItem[]>([]);

  const showToast = (toast: Omit<ToastItem, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastItem = { id, ...toast };
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const value: ToastContextType = {
    showToast,
    removeToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {props.children}
      <Portal mount={document.body}>
        <div style={{
          position: "fixed",
          "z-index": "var(--pact-z-index-toast)",
          "pointer-events": "none",
          top: "0",
          left: "0",
          width: "100vw",
          height: "100vh"
        }}>
          <For each={toasts()}>
            {(toast) => (
              <PactToast
                variant={toast.variant}
                title={toast.title}
                duration={toast.duration}
                position={toast.position}
                onDismiss={() => removeToast(toast.id)}
                actions={toast.actions}
              >
                {toast.message}
              </PactToast>
            )}
          </For>
        </div>
      </Portal>
    </ToastContext.Provider>
  );
};

// Convenience functions for common toast types
export const showErrorToast = (message: string, title = "Error") => {
  const context = useContext(ToastContext);
  if (context) {
    context.showToast({
      variant: "error",
      title,
      message,
      duration: 0, // Don't auto-dismiss errors
      position: "bottom-right",
    });
  }
};

export const showSuccessToast = (message: string, title = "Success") => {
  const context = useContext(ToastContext);
  if (context) {
    context.showToast({
      variant: "success",
      title,
      message,
      duration: 5000,
      position: "bottom-right",
    });
  }
};

export const showInfoToast = (message: string, title = "Info") => {
  const context = useContext(ToastContext);
  if (context) {
    context.showToast({
      variant: "info",
      title,
      message,
      duration: 5000,
      position: "bottom-right",
    });
  }
};

export const showWarningToast = (message: string, title = "Warning") => {
  const context = useContext(ToastContext);
  if (context) {
    context.showToast({
      variant: "warning",
      title,
      message,
      duration: 5000,
      position: "bottom-right",
    });
  }
};