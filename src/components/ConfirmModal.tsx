type ConfirmModalProps = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-pos-surface rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5 animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Red danger icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center ring-8 ring-red-100/50 dark:ring-red-900/10">
            <svg
              className="w-8 h-8 text-pos-danger"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h2 className="text-lg font-bold text-pos-text">{title}</h2>
          <p className="text-sm text-pos-muted leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 border border-pos-muted/20 text-pos-text rounded-xl font-medium text-sm touch-target hover:bg-pos-background hover:border-pos-muted/40 transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-pos-danger text-white rounded-xl font-bold text-sm touch-target hover:bg-red-700 hover:shadow-lg hover:shadow-red-500/25 active:scale-[0.98] transition-all"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
