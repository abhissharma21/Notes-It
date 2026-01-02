import React, { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import type { Block, InlineNode } from "../types";
import BlockContent from "./BlockContent";
import CodeBlock from "./CodeBlock";
import ParagraphBlock from "./ParagraphBlock";
import HeadingBlock from "./HeadingBlock";
import ListBlock from "./ListBlock";
import DividerBlock from "./DividerBlock";
import QuoteBlock from "./QuoteBlock";
import { useBlockLogic } from "../hooks/useBlockLogic";

export interface BlockProps {
  block: Block;
  index: number;
  listNumber: number;
  isSelected: boolean;
  isFocused: boolean;
  caretOffset: number | null;
  isSlashMenuOpen: boolean; // Must be passed to trigger re-renders

  onUpdateContent: (id: string, content: InlineNode[]) => void;
  onUpdateMetadata: (id: string, meta: Partial<Block>) => void;
  onSelectionChange: (id: string, offset: number) => void;
  onDeleteBlock: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent, id: string) => void;

  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (targetId: string) => void;
}

const GenericBlock = (props: BlockProps) => {
  const {
    block,
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
  const renderKey = isEmpty ? "empty" : "content";

  let placeholder = "Type '/' for commands";
  if (block.type === "quote") placeholder = "Quote";

  return (
    <div
      key={renderKey}
      ref={contentRef}
      className={`block block-${block.type}`}
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
};

const BlockComponent = React.memo(
  (props: BlockProps) => {
    const {
      block,
      index,
      listNumber,
      isSelected,
      isFocused,
      caretOffset,
      isSlashMenuOpen,
      ...handlers
    } = props;
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [showHandle, setShowHandle] = useState(false);

    let Component;
    if (block.type === "code") Component = <CodeBlock {...props} />;
    else if (block.type === "paragraph")
      Component = <ParagraphBlock {...props} />;
    else if (block.type === "heading") Component = <HeadingBlock {...props} />;
    else if (["bullet-list", "numbered-list"].includes(block.type))
      Component = <ListBlock {...props} />;
    else if (block.type === "quote") Component = <QuoteBlock {...props} />;
    else if (block.type === "divider") Component = <DividerBlock {...props} />;
    else Component = <GenericBlock {...props} />;

    return (
      <div
        className={`block-wrapper wrapper-${block.type} ${
          isSelected ? "selected" : ""
        }`}
        ref={wrapperRef}
        id={block.id}
        onMouseEnter={() => setShowHandle(true)}
        onMouseLeave={() => setShowHandle(false)}
        onDragOver={(e) => handlers.onDragOver(e, block.id)}
        onDrop={(e) => {
          e.stopPropagation();
          handlers.onDrop(block.id);
        }}
      >
        <div
          className="drag-handle"
          contentEditable={false}
          draggable
          onDragStart={() => handlers.onDragStart(block.id)}
          style={{ opacity: showHandle ? 1 : 0 }}
        >
          <GripVertical size={18} />
        </div>
        <div className="block-content-container">
          {Component}
          {block.children.length > 0 && block.isOpen && (
            <div className="block-children">
              {block.children.map((child, i) => (
                <BlockComponent
                  key={child.id}
                  block={child}
                  index={i}
                  listNumber={0}
                  isSelected={false}
                  isFocused={false}
                  caretOffset={null}
                  isSlashMenuOpen={false}
                  {...handlers}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
  (prev, next) => {
    // CRITICAL FIX:
    // If the slash menu is active for this block, we must re-render on every update.
    // This is because 'onKeyDown' is a closure that changes when selectedIndex changes.
    if (next.isSlashMenuOpen) return false;
    if (prev.isSlashMenuOpen !== next.isSlashMenuOpen) return false;

    return (
      prev.block === next.block &&
      prev.isSelected === next.isSelected &&
      prev.isFocused === next.isFocused &&
      prev.caretOffset === next.caretOffset &&
      prev.listNumber === next.listNumber
    );
  }
);

export default BlockComponent;
