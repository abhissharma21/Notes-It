import React from "react";
import BlockContent from "./BlockContent";
import type { Block, InlineNode } from "../types";
import { useBlockLogic } from "../hooks/useBlockLogic";

interface Props {
  block: Block;
  isFocused: boolean;
  caretOffset: number | null;
  onUpdateContent: (id: string, content: InlineNode[]) => void;
  onSelectionChange: (id: string, offset: number) => void;
  onKeyDown: (e: React.KeyboardEvent, id: string) => void;
  isSlashMenuOpen?: boolean;
  isRangeSelection?: boolean;
}

export default function ParagraphBlock(props: Props) {
  const {
    block,
    isFocused,
    caretOffset,
    onUpdateContent,
    onSelectionChange,
    onKeyDown,
    isSlashMenuOpen,
    isRangeSelection,
  } = props;

  const textAlign = props.block.props?.align || "left";

  const { contentRef, handleInput } = useBlockLogic({
    block,
    isFocused,
    caretOffset,
    onUpdateContent,
    isSlashMenuOpen,
    isRangeSelection,
  });

  const isEmpty = block.content.length === 0;

  // FIX SHAKING: Use stable key
  const renderKey = isEmpty ? "empty" : "content";

  return (
    <div
      key={renderKey}
      ref={contentRef}
      className="block block-paragraph"
      style={{ textAlign: textAlign }}
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
      data-placeholder={isEmpty && isFocused ? "Type '/' for commands" : ""}
    >
      <BlockContent content={block.content} />
    </div>
  );
}
