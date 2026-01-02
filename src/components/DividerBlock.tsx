import React, { useRef, useEffect } from "react";
import type { Block } from "../types";

interface Props {
  block: Block;
  isFocused: boolean;
  onDeleteBlock: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent, id: string) => void;
  onSelectionChange: (id: string, offset: number) => void;
}

export default function DividerBlock({
  block,
  isFocused,
  onDeleteBlock,
  onKeyDown,
  onSelectionChange,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus();
    }
  }, [isFocused]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      onDeleteBlock(block.id);
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter") {
      onKeyDown(e, block.id);
      return;
    }
  };

  return (
    <div
      ref={ref}
      tabIndex={0}
      className="block block-divider"
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelectionChange(block.id, 0);
      }}
      style={{
        padding: "24px 0",
        cursor: "default",
        outline: "none",
        width: "100%",
        userSelect: "none",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "2px",
          backgroundColor: isFocused ? "#2eaadc" : "#555", // High contrast
          borderRadius: "1px",
          transition: "background-color 0.2s ease",
        }}
      />
    </div>
  );
}
