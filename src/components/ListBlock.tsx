import React from "react";
import BlockContent from "./BlockContent";
import type { Block, InlineNode } from "../types";
import { useBlockLogic } from "../hooks/useBlockLogic";

interface Props {
  block: Block;
  listNumber: number; // Received from Editor.tsx loop
  isFocused: boolean;
  caretOffset: number | null;
  onUpdateContent: (id: string, content: InlineNode[]) => void;
  onSelectionChange: (id: string, offset: number) => void;
  onKeyDown: (e: React.KeyboardEvent, id: string) => void;
  isSlashMenuOpen: boolean;
}

export default function ListBlock(props: Props) {
  const {
    block,
    listNumber,
    isFocused,
    caretOffset,
    onUpdateContent,
    onSelectionChange,
    onKeyDown,
    isSlashMenuOpen,
  } = props;

  const { contentRef, handleInput } = useBlockLogic({
    block,
    isFocused,
    caretOffset,
    onUpdateContent,
    isSlashMenuOpen,
  });

  const isEmpty = block.content.length === 0;

  // Stable key prevents shaking. Only update if empty state changes (for placeholder)
  const renderKey = isEmpty ? "empty" : "content";

  const isOrdered = block.type === "numbered-list";

  return (
    <div
      className={`block-list-container ${block.type}`}
      style={{ display: "flex", alignItems: "flex-start", padding: "2px 0" }}
    >
      {/* Marker */}
      <div
        contentEditable={false}
        style={{
          userSelect: "none",
          width: "24px",
          marginRight: "8px", // Added spacing
          textAlign: "right",
          color: "#666",
          flexShrink: 0,
          lineHeight: "1.6",
          fontSize: "16px",
          fontWeight: 500,
        }}
      >
        {isOrdered ? `${listNumber}.` : "•"}
      </div>

      {/* Editable Text */}
      <div
        key={renderKey}
        ref={contentRef}
        className="block block-list"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={(e) => onKeyDown(e, block.id)}
        onMouseUp={() => {
          const sel = window.getSelection();
          if (sel?.anchorNode) onSelectionChange(block.id, sel.anchorOffset);
        }}
        onFocus={() => {
          if (!isFocused) onSelectionChange(block.id, 0);
        }}
        spellCheck={false}
        data-placeholder={isEmpty && isFocused ? "List" : ""}
        style={{ flex: 1, minWidth: 0, outline: "none" }}
      >
        <BlockContent content={block.content} />
      </div>
    </div>
  );
}
