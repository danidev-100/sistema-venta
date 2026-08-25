import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

type BarcodeScannerModalProps = {
  onDetected: (barcode: string) => void;
  onClose: () => void;
};

const SCANNER_ID = "barcode-scanner-region";

const SCAN_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.QR_CODE,
];

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function BarcodeScannerModal({ onDetected, onClose }: BarcodeScannerModalProps) {
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [errorMsg, setErrorMsg] = useState("");
  const handledRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Cerrar con Esc
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Iniciar cámara y detector al montar; limpiar al desmontar
  useEffect(() => {
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    async function startCamera() {
      const attempt = async (constraints: MediaTrackConstraints, freshScanner: boolean): Promise<boolean> => {
        if (freshScanner || !scanner) {
          scanner = new Html5Qrcode(SCANNER_ID, {
            formatsToSupport: SCAN_FORMATS,
            useBarCodeDetectorIfSupported: true,
            verbose: false,
          });
        }
        try {
          await scanner.start(
            constraints,
            {
              fps: 10,
              qrbox: { width: 260, height: 110 },
              disableFlip: true,
            },
            (decodedText) => {
              if (handledRef.current) return;
              handledRef.current = true;
              onDetectedRef.current(decodedText);
            },
            () => {
              /* errores por frame: ignorar */
            },
          );
          return true;
        } catch {
          return false;
        }
      };

      // Primero cámara trasera exacta; si falla, facingMode genérico.
      let ok = await attempt({ facingMode: { exact: "environment" } }, true);
      if (!ok) {
        if (scanner) { try { scanner.clear(); } catch { /* noop */ } }
        ok = await attempt({ facingMode: "environment" }, false);
      }
      if (!ok) {
        if (scanner) { try { scanner.clear(); } catch { /* noop */ } }
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(
            "Verificá que el sitio use HTTPS y que permitas el acceso a la cámara desde el navegador.",
          );
        }
        return;
      }
      if (!cancelled) setStatus("scanning");
    }

    startCamera();

    return () => {
      cancelled = true;
      if (scanner) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scanner!.clear();
            } catch {
              /* noop */
            }
          });
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={() => onCloseRef.current()}
    >
      <div
        className="w-full max-w-sm bg-pos-surface rounded-2xl shadow-2xl border border-pos-muted/10 mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-pos-muted/10 flex items-center justify-between">
          <h3 className="text-base font-bold text-pos-text">Escanear código</h3>
          <button
            onClick={() => onCloseRef.current()}
            className="w-8 h-8 flex items-center justify-center text-pos-muted/50 hover:text-pos-text rounded-lg hover:bg-pos-background/50 transition-colors touch-target"
            aria-label="Cerrar escáner"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {status === "starting" && (
            <p className="text-sm text-pos-muted text-center py-10">Iniciando cámara…</p>
          )}

          {status === "error" && (
            <div className="text-center py-6 space-y-3">
              <div className="text-4xl">📷</div>
              <p className="text-sm font-medium text-pos-danger">No se pudo acceder a la cámara.</p>
              <p className="text-xs text-pos-muted">{errorMsg}</p>
            </div>
          )}

          {status === "scanning" && (
            <>
              <div id={SCANNER_ID} className="w-full rounded-xl overflow-hidden bg-black" />
              <p className="text-xs text-pos-muted text-center mt-3">
                Apuntá al código de barras del producto
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}