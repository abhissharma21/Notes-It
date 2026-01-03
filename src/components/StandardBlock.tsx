import React from "react";
import BlockContent from "./BlockContent";
import type { Block, BlockType, InlineNode } from "../types";
import { useBlockLogic } from "../hooks/useBlockLogic";

interface Props {
  block: Block;
  listNumber: number;
  isFocused: boolean;
  caretOffset: number | null;
  onUpdateContent: (id: string, content: InlineNode[]) => void;
  onSelectionChange: (id: string, offset: number) => void;
  onKeyDown: (e: React.KeyboardEvent, id: string) => void;

  // New props for Preview
  previewType?: BlockType | null;
}

export default function StandardBlock(props: Props) {
  const {
    block,
    listNumber,
    isFocused,
    caretOffset,
    onUpdateContent,
    onSelectionChange,
    onKeyDown,
    previewType,
  } = props;

  const { contentRef, handleInput } = useBlockLogic({
    block,
    isFocused,
    caretOffset,
    onUpdateContent,
  });

  const isEmpty = block.content.length === 0;

  // STABLE KEY: We use 'content' string to avoid remounting unless necessary.
  // This allows CSS transitions (font-size) to animate on the existing node.
  const renderKey = isEmpty ? "empty" : "content";

  // --- PREVIEW LOGIC ---
  // If focused and we have a preview type (hovering in toolbar), use that.
  // Otherwise use the actual block type.
  const displayType = isFocused && previewType ? previewType : block.type;

  // --- DYNAMIC STYLES ---
  let placeholder = "Type '/' for commands";
  let wrapperClass = `block block-${displayType}`; // Base class

  // Handle Heading Levels
  if (displayType === "heading") {
    const level = block.props?.level || 1;
    wrapperClass = `block block-h${level}`;
    placeholder = `Heading ${level}`;

    // Preview logic for headings (if previewing 'h1', override level logic)
    if (previewType === "heading") {
      // We can't easily preview levels without passing previewLevel,
      // assuming standard heading preview maps to block-h1 for now or handled by parent mapping
    }
  }
  // Map specific legacy preview types
  if (previewType === ("h1" as any)) {
    wrapperClass = "block block-h1";
    placeholder = "Heading 1";
  }
  if (previewType === ("h2" as any)) {
    wrapperClass = "block block-h2";
    placeholder = "Heading 2";
  }
  if (previewType === ("h3" as any)) {
    wrapperClass = "block block-h3";
    placeholder = "Heading 3";
  }

  if (displayType === "quote") placeholder = "Quote";
  if (displayType === "bullet-list" || displayType === "numbered-list")
    placeholder = "List";

  // --- LIST MARKER LOGIC ---
  const isList =
    displayType === "bullet-list" || displayType === "numbered-list";
  const isOrdered = displayType === "numbered-list";

  return (
    <div
      className={`standard-block-container ${displayType}`}
      style={{ display: "flex", width: "100%" }}
    >
      {/* Render Marker for Lists */}
      {isList && (
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
            paddingTop: "4px",
          }}
        >
          {isOrdered ? `${listNumber}.` : "•"}
        </div>
      )}

      {/* Editable Content with Transition Class */}
      <div
        key={renderKey}
        ref={contentRef}
        className={wrapperClass} // CSS Transition handles animation here
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
        data-placeholder={isEmpty && isFocused ? placeholder : ""}
        style={{
          flex: 1,
          minWidth: 0,
          // Inline alignment style
          textAlign: block.props?.align || "left",
        }}
      >
        <BlockContent content={block.content} />
      </div>
    </div>
  );
}
