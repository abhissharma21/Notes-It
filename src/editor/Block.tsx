// src/editor/Block.tsx

import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import type { Block } from "./types";

interface Props {
  block: Block;
  index: number;
  isFocused: boolean;
  mouseActive: boolean;

  onInput: (index: number, text: string, el: HTMLDivElement) => void;

  onKeyDown: (e: React.KeyboardEvent, index: number) => void;
  onFocus: (index: number) => void;

  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
}

export default function Block({
  block,
  index,
  isFocused,
  mouseActive,
  onInput,
  onKeyDown,
  onFocus,
  onDragStart,
  onDragOver,
  onDrop,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Mount text once (DOM owns content)
  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = block.text;
    }
  }, []);

  // Editor-controlled caret
  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus();

      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(true);

      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isFocused]);

  /* ✅ FINAL drag-handle rule */
  const showHandle = isHovered && mouseActive;

  return (
    <div
      className="block-wrapper"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(index);
      }}
      onDrop={onDrop}
    >
      <div className="drag-handle" style={{ opacity: showHandle ? 1 : 0 }}>
        <GripVertical size={16} />
      </div>

      <div
        ref={ref}
        className={`block block-${block.type}`}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-placeholder={isFocused && !block.text ? "Type / for commands" : ""}
        dir="ltr"
        style={{
          direction: "ltr",
          unicodeBidi: "isolate",
          textAlign: "left",
        }}
        onInput={(e) =>
          onInput(index, e.currentTarget.textContent ?? "", e.currentTarget)
        }
        onKeyDown={(e) => onKeyDown(e, index)}
        onFocus={() => onFocus(index)}
      />
    </div>
  );
}
