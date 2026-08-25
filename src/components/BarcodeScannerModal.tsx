import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

type BarcodeScannerModalProps = {
  onDetected: (barcode: string) => void;
  onClose: () => void;
};

const SCANNER_ID = "barcode-scanner-region";
const START_TIMEOUT_MS = 15000;

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

  // Iniciar cámara y detector al montar; limpiar al desmontar.
  // IMPORTANTE: el elemento #barcode-scanner-region debe existir en el DOM
  // ANTES de llamar Html5Qrcode.start() (por eso se renderiza siempre).
  useEffect(() => {
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function makeScanner() {
      return new Html5Qrcode(SCANNER_ID, {
        formatsToSupport: SCAN_FORMATS,
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
    }

    async function tryStart(constraints: string | MediaTrackConstraints) {
      if (!scanner) scanner = makeScanner();
      await scanner.start(
        constraints,
        {
          fps: 10,
          qrbox: { width: 260, height: 110 },
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
    }

    async function startCamera() {
      // Timeout de seguridad: nunca quedarse colgado en "starting"
      timeoutId = setTimeout(() => {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg("La cámara tardó demasiado en iniciar. Probá de nuevo.");
        }
      }, START_TIMEOUT_MS);

      try {
        // 1) Intentar con la cámara trasera detectada por getCameras()
        let started = false;
        try {
          const cameras = await Html5Qrcode.getCameras().catch(() => []);
          const back =
            cameras.find((c) => /back|rear|trasera|trás/i.test(c.label)) ??
            cameras[cameras.length - 1];
          if (back) {
            await tryStart(back.id);
            started = true;
          }
        } catch {
          /* getCameras falló o no hay cámaras: seguir con facingMode */
        }

        // 2) Fallback: facingMode trasera exacta
        if (!started) {
          try {
            await tryStart({ facingMode: { exact: "environment" } });
            started = true;
          } catch {
            if (scanner) {
              try {
                scanner.clear();
              } catch {
                /* noop */
              }
            }
            scanner = makeScanner();
            // 3) Último fallback: facingMode genérico
            await tryStart({ facingMode: "environment" });
            started = true;
          }
        }

        if (timeoutId) clearTimeout(timeoutId);
        if (!cancelled) setStatus("scanning");
      } catch {
        if (timeoutId) clearTimeout(timeoutId);
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(
            "No se pudo acceder a la cámara. Verificá que el sitio use HTTPS y que permitas el acceso a la cámara desde el navegador.",
          );
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
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
          {status === "error" ? (
            <div className="text-center py-6 space-y-3">
              <div className="text-4xl">📷</div>
              <p className="text-sm font-medium text-pos-danger">No se pudo iniciar la cámara.</p>
              <p className="text-xs text-pos-muted">{errorMsg}</p>
            </div>
          ) : (
            <>
              {/* El contenedor del video SIEMPRE está en el DOM para que start() lo encuentre */}
              <div className="relative w-full rounded-xl overflow-hidden bg-black">
                <div id={SCANNER_ID} className={status === "starting" ? "min-h-[200px]" : ""} />
                {status === "starting" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-sm text-white/80">Iniciando cámara…</p>
                  </div>
                )}
              </div>
              {status === "scanning" && (
                <p className="text-xs text-pos-muted text-center mt-3">
                  Apuntá al código de barras del producto
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}