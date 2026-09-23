"use client";

import { useCallback, useEffect, useRef } from "react";
import { Copy } from "lucide-react";

interface ContextMenuItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[200px] rounded-md border border-gray-200 bg-white shadow-lg py-1"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => (
        <button
          key={index}
          type="button"
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer"
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          {item.icon && <span className="w-4 h-4 flex items-center justify-center text-gray-500">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}
