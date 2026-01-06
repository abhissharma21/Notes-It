import { useRef, useEffect, useLayoutEffect } from "react";
import type { Block, InlineNode } from "../types";
import { parseDOMToContent, getCaretOffset, setCaretOffset } from "../utils";

interface UseBlockLogicProps {
  block: Block;
  isFocused: boolean;
  caretOffset: number | null;
  onUpdateContent: (id: string, content: InlineNode[]) => void;
  isSlashMenuOpen?: boolean;
  isRangeSelection?: boolean;
}

export function useBlockLogic({
  block,
  isFocused,
  caretOffset,
  onUpdateContent,
  isSlashMenuOpen,
  isRangeSelection,
}: UseBlockLogicProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const cursorOffsetRef = useRef<number | null>(null);

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

  useLayoutEffect(() => {
    if (cursorOffsetRef.current !== null && contentRef.current && isFocused) {
      setCaretOffset(contentRef.current, cursorOffsetRef.current);
      cursorOffsetRef.current = null;
    }
  }, [block.content, isFocused]);

  useLayoutEffect(() => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;

    if (isFocused && contentRef.current && caretOffset !== null) {
      setCaretOffset(contentRef.current, caretOffset);
    }
  }, [isFocused, caretOffset, isRangeSelection]);

  useEffect(() => {
    if (isSlashMenuOpen) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;

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
            const selection = window.getSelection();
            range.setStart(contentRef.current, 0);
            range.collapse(true);
            selection?.removeAllRanges();
            selection?.addRange(range);
          } else {
            setCaretOffset(contentRef.current, caretOffset);
          }
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [isFocused, caretOffset, block.type, isSlashMenuOpen]); 

  return {
    contentRef,
    handleInput,
  };
}
