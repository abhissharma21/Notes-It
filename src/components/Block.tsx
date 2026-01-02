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
  isSlashMenuOpen: boolean;

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

const BlockComponentRaw: React.FC<BlockProps> = (props) => {
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
  if (block.type === "code") {
    Component = <CodeBlock {...props} />;
  } else if (block.type === "paragraph") {
    Component = <ParagraphBlock {...props} />;
  } else if (block.type === "heading") {
    Component = <HeadingBlock {...props} />;
  } else if (["bullet-list", "numbered-list"].includes(block.type)) {
    Component = <ListBlock {...props} />;
  } else if (block.type === "quote") {
    Component = <QuoteBlock {...props} />;
  } else if (block.type === "divider") {
    Component = <DividerBlock {...props} />;
  } else {
    Component = <GenericBlock {...props} />;
  }

  let wrapperClass = `wrapper-${block.type}`;
  if (block.type === "heading") {
    const level = block.props?.level || 1;
    wrapperClass = `wrapper-h${level}`;
  }

  return (
    <div
      className={`block-wrapper ${wrapperClass} ${
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
        style={{ opacity: showHandle ? 1 : 0 }}
        onDragStart={(e) => {
          e.stopPropagation();
          handlers.onDragStart(block.id);
          if (wrapperRef.current) {
            e.dataTransfer.setDragImage(wrapperRef.current, 0, 0);
          }
        }}
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
};

const BlockComponent = React.memo(BlockComponentRaw, (prev, next) => {
  // FIX: If the slash menu is open for this block, we MUST re-render.
  // This ensures the 'onKeyDown' prop (which contains the updated selectedIndex) is fresh.
  if (next.isSlashMenuOpen) return false;

  // Also catch the transition from Open -> Closed
  if (prev.isSlashMenuOpen !== next.isSlashMenuOpen) return false;

  return (
    prev.block === next.block &&
    prev.isSelected === next.isSelected &&
    prev.isFocused === next.isFocused &&
    prev.caretOffset === next.caretOffset &&
    prev.listNumber === next.listNumber
  );
});

export default BlockComponent;
