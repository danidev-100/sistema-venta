import { useAppStore } from "@/store";

// Simple page — web version doesn't require activation
export default function ActivationPage() {
  const setPage = useAppStore((s) => s.setPage);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl dark:bg-gray-800">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-pos-secondary text-2xl text-white shadow-sm">
          B
        </div>
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
          SISTEMA VENTA
        </h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Punto de Venta — Versión Web
        </p>
        <button
          onClick={() => setPage("login")}
          className="w-full rounded-xl bg-pos-secondary px-4 py-3 font-semibold text-white shadow transition hover:opacity-90"
        >
          Ir al inicio
        </button>
      </div>
    </div>
  );
}
