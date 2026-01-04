import React, { useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import type { Block, InlineNode, BlockType } from "../types";
import CodeBlock from "./CodeBlock";
import ParagraphBlock from "./ParagraphBlock";
import HeadingBlock from "./HeadingBlock";
import ListBlock from "./ListBlock";
import DividerBlock from "./DividerBlock";
import QuoteBlock from "./QuoteBlock";
import DrawioBlock from "./DrawioBlock";
import StandardBlock from "./StandardBlock";
import ImageBlock from "./ImageBlock";

export interface BlockProps {
  block: Block;
  index: number;
  listNumber: number;
  isSelected: boolean;
  isFocused: boolean;
  caretOffset: number | null;
  selectionEnd?: number | null; // Optional to prevent TS errors
  isSlashMenuOpen: boolean;
  isRangeSelection: boolean;
  previewType?: BlockType | null;
  dropTarget: { id: string; pos: "top" | "bottom" } | null;

  onUpdateContent: (id: string, content: InlineNode[]) => void;
  onUpdateMetadata: (id: string, meta: Partial<Block>) => void;
  onSelectionChange: (id: string, offset: number) => void;
  onDeleteBlock: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent, id: string) => void;
  onAddParagraphBelow: (id: string) => void;

  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (targetId: string) => void;
}

const BlockComponentRaw: React.FC<BlockProps> = (props) => {
  const {
    block,
    index,
    listNumber,
    isSelected,
    isFocused,
    caretOffset,
    selectionEnd,
    isSlashMenuOpen,
    isRangeSelection,
    dropTarget,
    previewType,
    onAddParagraphBelow,
    ...handlers
  } = props;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [showHandle, setShowHandle] = useState(false);

  const isDropTarget = dropTarget?.id === block.id;
  const dropPos = isDropTarget ? dropTarget.pos : null;

  // --- ROUTER ---
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
  } else if (block.type === "drawio") {
    Component = (
      <DrawioBlock {...props} onAddParagraphBelow={onAddParagraphBelow} />
    );
  } else if (block.type === "image") {
    Component = (
      <ImageBlock {...props} onAddParagraphBelow={onAddParagraphBelow} />
    );
  } else {
    Component = <StandardBlock {...props} previewType={previewType} />;
  }

  // Wrapper class for drag handle alignment
  let wrapperClass = `wrapper-${block.type}`;
  if (block.type === "heading") {
    const level = block.props?.level || 1;
    wrapperClass = `wrapper-h${level}`;
  }
  // Preview overrides wrapper class
  if (isFocused && previewType) {
    if (previewType === ("h1" as any)) wrapperClass = `wrapper-h1`;
    else if (previewType === ("h2" as any)) wrapperClass = `wrapper-h2`;
    else if (previewType === ("h3" as any)) wrapperClass = `wrapper-h3`;
    else wrapperClass = `wrapper-${previewType}`;
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
      style={{ position: "relative" }}
    >
      {isDropTarget && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: "3px",
            backgroundColor: "#2eaadc",
            borderRadius: "2px",
            zIndex: 100,
            pointerEvents: "none",
            top: dropPos === "top" ? "-2px" : "auto",
            bottom: dropPos === "bottom" ? "-2px" : "auto",
          }}
        />
      )}

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
                selectionEnd={null}
                isSlashMenuOpen={false}
                isRangeSelection={false}
                dropTarget={dropTarget}
                previewType={null}
                onAddParagraphBelow={onAddParagraphBelow}
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
  if (next.isSlashMenuOpen) return false;
  if (prev.isSlashMenuOpen !== next.isSlashMenuOpen) return false;
  if (prev.isRangeSelection !== next.isRangeSelection) return false;
  if (prev.previewType !== next.previewType) return false;

  const prevIsTarget = prev.dropTarget?.id === prev.block.id;
  const nextIsTarget = next.dropTarget?.id === next.block.id;
  if (prevIsTarget !== nextIsTarget) return false;
  if (
    prevIsTarget &&
    nextIsTarget &&
    prev.dropTarget?.pos !== next.dropTarget?.pos
  )
    return false;

  return (
    prev.block === next.block &&
    prev.isSelected === next.isSelected &&
    prev.isFocused === next.isFocused &&
    prev.caretOffset === next.caretOffset &&
    prev.selectionEnd === next.selectionEnd &&
    prev.listNumber === next.listNumber
  );
});

export default BlockComponent;
