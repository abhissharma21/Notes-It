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

export default function HeadingBlock(props: Props) {
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

  const { contentRef, handleInput } = useBlockLogic({
    block,
    isFocused,
    caretOffset,
    onUpdateContent,
    isSlashMenuOpen,
    isRangeSelection,
  });

  // Safe access to level, default to 1
  const level = block.props?.level || 1;

  const isEmpty = block.content.length === 0;
  // Stable key prevents shaking
  const renderKey = isEmpty ? "empty" : "content";

  const placeholder = `Heading ${level}`;
  const className = `block block-h${level}`;

  return (
    <div
      key={renderKey}
      ref={contentRef}
      className={className}
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
    >
      <BlockContent content={block.content} />
    </div>
  );
}
