import { useEffect, useRef } from "react";
import type { Block } from "./types";

type Props = {
  block: Block;
  focused: boolean;
  isMenuOpen: boolean;
  onChange: (text: string) => void;
  onEnter: () => void;
  onBackspaceAtStart: () => void;
  onArrowUpAtStart: () => void;
  onArrowDownAtEnd: () => void;
  onSlashDetected: (el: HTMLDivElement) => void;
};

export default function BlockComponent({
  block,
  focused,
  isMenuOpen,
  onChange,
  onEnter,
  onBackspaceAtStart,
  onArrowUpAtStart,
  onArrowDownAtEnd,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const isDivider = block.type === "divider";

  // Sync text content
  useEffect(() => {
    if (ref.current) {
      if (isDivider) {
        ref.current.textContent = "";
      } else if (ref.current.textContent !== block.text) {
        ref.current.textContent = block.text;
      }
    }
  }, [block.text, isDivider]);

  // Handle Focus
  useEffect(() => {
    if (focused && ref.current) {
      ref.current.focus();
      if (!isDivider) {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(ref.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [focused, block.type, isDivider]);

  return (
    <div
      ref={ref}
      contentEditable={!isDivider}
      tabIndex={isDivider ? 0 : undefined}
      suppressContentEditableWarning
      className={`block block-${block.type} ${focused ? "is-focused" : ""}`}
      spellCheck={false}
      onInput={(e) => !isDivider && onChange(e.currentTarget.textContent ?? "")}
      onKeyDown={(e) => {
        if (e.key === "Enter" && isMenuOpen) return;

        const sel = window.getSelection();
        const offset = sel?.rangeCount ? sel.getRangeAt(0).startOffset : 0;

        // Navigation logic
        const isAtStart = isDivider || offset === 0;
        const isAtEnd =
          isDivider || offset === (ref.current?.textContent?.length ?? 0);

        if (e.key === "Enter") {
          e.preventDefault();
          onEnter();
        } else if (e.key === "Backspace" && isAtStart) {
          e.preventDefault();
          onBackspaceAtStart();
        } else if (e.key === "ArrowUp" && isAtStart) {
          e.preventDefault();
          onArrowUpAtStart();
        } else if (e.key === "ArrowDown" && isAtEnd) {
          e.preventDefault();
          onArrowDownAtEnd();
        }
      }}
    >
      {isDivider && <div className="divider-line" />}
    </div>
  );
}
