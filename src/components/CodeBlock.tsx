import React, { useRef, useLayoutEffect, useState, useEffect } from "react";
import { ChevronDown, Check, Trash, Search } from "lucide-react";
import BlockContent from "./BlockContent";
import type { Block, InlineNode } from "../types";
import { parseDOMToContent, getCaretOffset, setCaretOffset } from "../utils";

interface Props {
  block: Block;
  isFocused: boolean;
  caretOffset: number | null;
  onUpdateContent: (id: string, content: InlineNode[]) => void;
  onUpdateMetadata: (id: string, meta: Partial<Block>) => void;
  onSelectionChange: (id: string, offset: number) => void;
  onDeleteBlock: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent, id: string) => void;
}

const LANGUAGES = [
  "TypeScript",
  "JavaScript",
  "Python",
  "HTML",
  "CSS",
  "SQL",
  "Rust",
  "JSON",
];

export default function CodeBlock({
  block,
  isFocused,
  caretOffset,
  onUpdateContent,
  onUpdateMetadata,
  onSelectionChange,
  onDeleteBlock,
  onKeyDown,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const cursorOffsetRef = useRef<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [version, setVersion] = useState(0); // Forces re-render on edit

  const currentLanguage = block.props?.language || "TypeScript";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      )
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      document.execCommand("insertText", false, "  ");
      return;
    }
    if (e.key === "Enter") {
      if (e.metaKey || e.ctrlKey) {
        onKeyDown(e, block.id);
        return;
      }
      e.preventDefault();
      document.execCommand("insertText", false, "\n");
      return;
    }
    onKeyDown(e, block.id);
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (contentRef.current)
      cursorOffsetRef.current = getCaretOffset(contentRef.current);
    const newContent = parseDOMToContent(e.currentTarget, block.content);
    onUpdateContent(block.id, newContent);
    setVersion((v) => v + 1); // Force fresh DOM
  };

  useLayoutEffect(() => {
    if (cursorOffsetRef.current !== null && contentRef.current && isFocused) {
      setCaretOffset(contentRef.current, cursorOffsetRef.current);
      cursorOffsetRef.current = null;
    }
  }, [block.content, isFocused, version]);

  useLayoutEffect(() => {
    if (isFocused && contentRef.current && caretOffset !== null) {
      setCaretOffset(contentRef.current, caretOffset);
    }
  }, [isFocused, caretOffset]);

  const rawText = block.content.map((n) => n.text).join("");
  const hasTrailingNewline = rawText.endsWith("\n");

  return (
    <div
      className="block-code-container"
      style={{ position: "relative", marginTop: 4 }}
    >
      <div
        contentEditable={false}
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
          userSelect: "none",
        }}
      >
        <div style={{ position: "relative" }} ref={dropdownRef}>
          <div
            onClick={() => setIsOpen(!isOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              color: "#aaa",
              cursor: "pointer",
              background: isOpen ? "#333" : "transparent",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            <span>{currentLanguage}</span>
            <ChevronDown size={12} />
          </div>
          {isOpen && (
            <div className="custom-dropdown-menu">
              {LANGUAGES.map((lang) => (
                <div
                  key={lang}
                  className="dropdown-option"
                  onClick={() => {
                    onUpdateMetadata(block.id, {
                      props: { ...block.props, language: lang },
                    });
                    setIsOpen(false);
                  }}
                >
                  {lang}
                </div>
              ))}
            </div>
          )}
        </div>
        <div
          onClick={() => onDeleteBlock(block.id)}
          style={{ cursor: "pointer", color: "#666" }}
        >
          <Trash size={14} />
        </div>
      </div>

      <div
        key={`${block.id}-${version}`} // Stable key logic
        ref={contentRef}
        className="block block-code"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onMouseUp={() => {
          const sel = window.getSelection();
          if (sel?.anchorNode) onSelectionChange(block.id, sel.anchorOffset);
        }}
        onFocus={() => {
          if (!isFocused) onSelectionChange(block.id, 0);
        }}
        spellCheck={false}
        style={{
          whiteSpace: "pre-wrap",
          fontFamily: "monospace",
          minHeight: "40px",
        }}
      >
        <BlockContent content={block.content} />
        {hasTrailingNewline && <br />}
      </div>
    </div>
  );
}
