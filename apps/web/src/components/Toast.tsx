import { useEffect } from "react";

export interface ToastData {
  kind: "ok" | "error";
  message: string;
}

export default function Toast({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onClose, 4000);
    return () => clearTimeout(id);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div className={`toast toast--${toast.kind}`} role="status">
      <span>{toast.message}</span>
      <button onClick={onClose} aria-label="Cerrar aviso">
        ×
      </button>
    </div>
  );
}
