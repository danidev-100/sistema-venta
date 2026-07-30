import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Hook para navegación por teclado en listas desplegables.
 *
 * - Auto-selecciona el primer resultado cuando cambia itemCount
 * - ArrowUp / ArrowDown navega por la lista (cíclico)
 * - Enter confirma la selección actual
 */
export function useKeyboardListNavigation({
  itemCount,
  onSelect,
  enabled,
}: {
  itemCount: number;
  onSelect: (index: number) => void;
  enabled: boolean;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Reset al primer resultado cuando cambia la lista
  useEffect(() => {
    setSelectedIndex(0);
  }, [itemCount]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled || itemCount === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % itemCount);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + itemCount) % itemCount);
          break;
        case "Enter":
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < itemCount) {
            onSelectRef.current(selectedIndex);
          }
          break;
      }
    },
    [enabled, itemCount, selectedIndex],
  );

  return { selectedIndex, handleKeyDown, setSelectedIndex };
}
