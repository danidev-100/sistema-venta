import { useState } from "react";

interface ProductImageProps {
  src?: string | null;
  /** Clases para el <img> (tamaño + object-cover, etc.) */
  imgClassName?: string;
  /** Clases para el contenedor placeholder (tamaño + bg + redondeo) */
  boxClassName?: string;
  /** Clases para el ícono placeholder */
  iconClassName?: string;
  alt?: string;
}

/**
 * Miniatura de producto con fallback: si la URL de imagen falla
 * (404, red caída), muestra el ícono placeholder en vez de una imagen rota.
 */
export default function ProductImage({
  src,
  imgClassName,
  boxClassName,
  iconClassName,
  alt = "",
}: ProductImageProps) {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={`flex items-center justify-center ${boxClassName ?? ""}`}>
        <svg
          className={iconClassName ?? "w-4 h-4 text-pos-muted/30"}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={imgClassName}
      onError={() => setError(true)}
    />
  );
}
