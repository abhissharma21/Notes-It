import React from "react";
import BlockContent from "./BlockContent";
import type { Block, BlockType, InlineNode } from "../types";
import { useBlockLogic } from "../hooks/useBlockLogic";

interface Props {
  block: Block;
  listNumber: number;
  isFocused: boolean;
  caretOffset: number | null;
  selectionEnd: number | null;
  onUpdateContent: (id: string, content: InlineNode[]) => void;
  onSelectionChange: (id: string, offset: number) => void;
  onKeyDown: (e: React.KeyboardEvent, id: string) => void;
  previewType?: BlockType | null;
  isSlashMenuOpen: boolean;
  isRangeSelection: boolean;
}

export default function StandardBlock(props: Props) {
  const {
    block,
    listNumber,
    isFocused,
    caretOffset,
    selectionEnd,
    onUpdateContent,
    onSelectionChange,
    onKeyDown,
    previewType,
    isSlashMenuOpen,
    isRangeSelection,
  } = props;

  const {
    contentRef,
    handleInput,
    handleCompositionStart,
    handleCompositionEnd,
  } = useBlockLogic({
    block,
    isFocused,
    caretOffset,
    selectionEnd,
    onUpdateContent,
    isSlashMenuOpen,
    isRangeSelection,
  });

  const isEmpty = block.content.length === 0;

  // FIX: Force remount if content structure changes (length) to prevent removeChild error.
  // The useBlockLogic hook handles cursor restoration, so this remount is seamless.
  const renderKey = `${isEmpty ? "empty" : "content"}-${block.content.length}`;

  const displayType = isFocused && previewType ? previewType : block.type;

  let placeholder = "Type '/' for commands";
  let wrapperClass = `block block-${displayType}`;

  if (displayType === "heading") {
    const level = block.props?.level || 1;
    wrapperClass = `block block-h${level}`;
    placeholder = `Heading ${level}`;
  }

  if (displayType === "bullet-list" || displayType === "numbered-list")
    placeholder = "List";
  if (displayType === "quote") placeholder = "Quote";

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

  const isList =
    displayType === "bullet-list" || displayType === "numbered-list";
  const isOrdered = displayType === "numbered-list";

  return (
    <div
      className={`standard-block-container ${displayType}`}
      style={{ display: "flex", width: "100%" }}
    >
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

      <div
        key={renderKey} // <--- Critical Fix
        ref={contentRef}
        className={wrapperClass}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
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
          textAlign: block.props?.align || "left",
        }}
      >
        <BlockContent content={block.content} />
      </div>
    </div>
  );
}
