import { useRef, useEffect, useLayoutEffect } from "react";
import type { Block, InlineNode } from "../types";
import { parseDOMToContent, getCaretOffset, setCaretOffset } from "../utils";

interface UseBlockLogicProps {
  block: Block;
  isFocused: boolean;
  caretOffset: number | null;
  onUpdateContent: (id: string, content: InlineNode[]) => void;
  isSlashMenuOpen?: boolean; // <--- NEW PROP
}

export function useBlockLogic({
  block,
  isFocused,
  caretOffset,
  onUpdateContent,
  isSlashMenuOpen,
}: UseBlockLogicProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const cursorOffsetRef = useRef<number | null>(null);

  // Stale State Protection
  const latestContentRef = useRef<InlineNode[]>(block.content);
  if (block.content !== latestContentRef.current) {
    latestContentRef.current = block.content;
  }

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (contentRef.current) {
      cursorOffsetRef.current = getCaretOffset(contentRef.current);
    }
    const newContent = parseDOMToContent(
      e.currentTarget,
      latestContentRef.current
    );
    latestContentRef.current = newContent;
    onUpdateContent(block.id, newContent);
  };

  // Restore Cursor (Typing)
  useLayoutEffect(() => {
    if (cursorOffsetRef.current !== null && contentRef.current && isFocused) {
      setCaretOffset(contentRef.current, cursorOffsetRef.current);
      cursorOffsetRef.current = null;
    }
  }, [block.content, isFocused]);

  // Restore Cursor (Navigation)
  useLayoutEffect(() => {
    if (isFocused && contentRef.current && caretOffset !== null) {
      setCaretOffset(contentRef.current, caretOffset);
    }
  }, [isFocused, caretOffset]);

  // Force Focus
  useEffect(() => {
    // If slash menu is open, DO NOT force focus.
    // This allows the user to click the menu items without the input stealing focus back immediately.
    if (isSlashMenuOpen) return;

    if (isFocused && contentRef.current) {
      if (document.activeElement !== contentRef.current) {
        contentRef.current.focus();
      }
      const rafId = requestAnimationFrame(() => {
        if (
          contentRef.current &&
          document.activeElement !== contentRef.current
        ) {
          contentRef.current.focus();
          if (caretOffset === null) {
            const range = document.createRange();
            const sel = window.getSelection();
            range.setStart(contentRef.current, 0);
            range.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(range);
          } else {
            setCaretOffset(contentRef.current, caretOffset);
          }
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [isFocused, caretOffset, block.type, isSlashMenuOpen]); // Added dependency

  return {
    contentRef,
    handleInput,
  };
}
