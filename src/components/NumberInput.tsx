import { useState, useEffect, useCallback, useRef, forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

/**
 * Parsea un string formateado argentino a number.
 * "1.500,50" → 1500.5
 */
function parseInput(raw: string): number {
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

/**
 * Agrega separador de miles en vivo.
 * "1500" → "1.500"
 * "1500000,50" → "1.500.000,50"
 */
function formatLive(raw: string, decimals: number): string {
  // Guardar signo negativo
  const negative = raw.startsWith("-");
  const digits = negative ? raw.slice(1) : raw;

  // Separar parte entera y decimal
  const parts = digits.split(",");
  let intRaw = parts[0].replace(/\D/g, "");
  const decRaw = parts.length > 1 ? parts[1].replace(/\D/g, "").slice(0, decimals) : "";
  const hasComma = parts.length > 1;

  // Poner puntos de miles
  intRaw = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const prefix = negative ? "-" : "";
  if (decRaw) return `${prefix}${intRaw},${decRaw}`;
  if (hasComma) return `${prefix}${intRaw},`;
  return `${prefix}${intRaw}`;
}

/**
 * Encuentra la posición del cursor en el string formateado,
 * partiendo de la posición que tenía en el string sin formato.
 *
 * Ej: raw = "15000", cursorRaw = 3 → formatted = "15.000", cursor = 4
 */
function calcCursor(
  rawBefore: string,        // texto antes del cambio (con posible formato)
  rawCursor: number,         // posición del cursor en rawBefore
  formatted: string,         // texto formateado final
): number {
  // Si el cursor está al final, devolver el final del formateado
  if (rawCursor >= rawBefore.length) return formatted.length;

  // Extraer dígitos antes del cursor en el texto original
  const prefixBefore = rawBefore.slice(0, rawCursor);
  const digitsBefore = prefixBefore.replace(/\./g, "").replace(/[^0-9]/g, "").length;

  if (digitsBefore <= 0) return 0;
  if (digitsBefore >= formatted.replace(/[^0-9]/g, "").length) return formatted.length;

  // Buscar dónde cae el enésimo dígito en el texto formateado
  let count = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] >= "0" && formatted[i] <= "9") count++;
    if (count >= digitsBefore) return i + 1;
  }

  return formatted.length;
}

// ──────────────────────────────────────────────
// Props
// ──────────────────────────────────────────────

export type NumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "inputMode"
> & {
  value: number;
  onChange: (val: number) => void;
  /** Cantidad de decimales permitidos (default 2) */
  decimals?: number;
};

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    { value, onChange, decimals = 2, className = "", onFocus, onBlur, ...rest },
    forwardedRef,
  ) {
  const [display, setDisplay] = useState("");
  const [focused, setFocused] = useState(false);
  const innerRef = useRef<HTMLInputElement | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Sincronizar display con value externo cuando no estamos enfocados
  useEffect(() => {
    if (!focused) {
      setDisplay(value.toLocaleString("es-AR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }));
    }
  }, [value, decimals, focused]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const val = input.value;
      const rawCursor = input.selectionStart ?? 0;

      // Vacío
      if (val === "") {
        setDisplay("");
        onChange(0);
        return;
      }

      // Normalizar: distinguir punto decimal de punto de miles
      let rawContent = val.replace(/[^0-9,.\-]/g, "");
      const dotParts = rawContent.split(".");
      if (dotParts.length > 1) {
        const lastSeg = dotParts[dotParts.length - 1];
        if (lastSeg.length <= decimals && /^\d+$/.test(lastSeg)) {
          // El último punto es decimal → convertirlo a coma
          rawContent = dotParts.slice(0, -1).join("").replace(/\D/g, "") + "," + lastSeg;
        } else {
          // Los puntos son separadores de miles → sacarlos
          rawContent = rawContent.replace(/\./g, "");
        }
      }

      // Limitar decimales
      const parts = rawContent.split(",");
      if (parts.length > 2) return; // más de una coma
      if (parts.length === 2 && parts[1].length > decimals) {
        // No actualizar — ya se alcanzó el máximo de decimales
        return;
      }

      // Solo dígitos sin format (para value numérico)
      const digitsOnly = rawContent.replace(/,/g, "");
      if (digitsOnly === "") {
        setDisplay("");
        onChange(0);
        return;
      }

      // Formatear en vivo
      const formatted = formatLive(rawContent, decimals);
      setDisplay(formatted);
      onChange(parseInput(rawContent));

      // Restaurar cursor
      requestAnimationFrame(() => {
        const newCursor = calcCursor(val, rawCursor, formatted);
        input.setSelectionRange?.(newCursor, newCursor);
      });
    },
    [decimals, onChange],
  );

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(true);
      // Mostrar valor crudo y seleccionar todo para que al escribir reemplace
      setDisplay(value.toFixed(decimals));
      requestAnimationFrame(() => {
        e.currentTarget.select();
      });
      onFocus?.(e);
    },
    [value, decimals, onFocus],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      const formatted = valueRef.current.toLocaleString("es-AR", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      setDisplay(formatted);
      onBlur?.(e);
    },
    [decimals, onBlur],
  );

  const setRef = useCallback(
    (node: HTMLInputElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
    },
    [forwardedRef],
  );

  return (
    <input
      ref={setRef}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      {...rest}
    />
  );
  },
);

export default NumberInput;
