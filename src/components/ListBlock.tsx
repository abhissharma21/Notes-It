import React from "react";
import BlockContent from "./BlockContent";
import type { Block, InlineNode } from "../types";
import { useBlockLogic } from "../hooks/useBlockLogic";

interface Props {
  block: Block;
  listNumber: number;
  isFocused: boolean;
  caretOffset: number | null;
  onUpdateContent: (id: string, content: InlineNode[]) => void;
  onSelectionChange: (id: string, offset: number) => void;
  onKeyDown: (e: React.KeyboardEvent, id: string) => void;
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
  } = props;

  const { contentRef, handleInput } = useBlockLogic({
    block,
    isFocused,
    caretOffset,
    onUpdateContent,
  });

  const isEmpty = block.content.length === 0;
  const renderKey = isEmpty ? "empty" : "content";
  const isOrdered = block.type === "numbered-list";

  return (
    <div
      className={`block-list-container ${block.type}`}
      style={{ display: "flex", alignItems: "flex-start" }}
    >
      {/* Marker */}
      <div
        contentEditable={false}
        style={{
          userSelect: "none",
          width: "24px",
          marginRight: "8px",
          textAlign: "right",
          color: "#666",
          flexShrink: 0,
          lineHeight: "1.6",
          fontSize: "16px",
          fontWeight: 500,
          // FIX: Add padding to match the text block's padding (defined in CSS as 4px)
          paddingTop: "4px",
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
