"use client";

import { ReactNode, useState } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 6,
    });
    setVisible(true);
  };

  const handleMouseLeave = () => {
    setVisible(false);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-flex"
    >
      {children}
      {visible && (
        <div
          className="fixed z-50 px-3 py-2 rounded-md border border-gray-200 bg-white shadow-lg text-xs text-gray-700 max-w-xs pointer-events-none"
          style={{ left: position.x, top: position.y, transform: 'translateX(-50%)' }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
