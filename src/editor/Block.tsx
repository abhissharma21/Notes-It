import { useEffect, useRef, useState } from "react";
import { GripVertical, ChevronDown } from "lucide-react";
import type { Block, BlockType } from "./types";

interface Props {
  block: Block;
  index: number;
  focusedId: string | null;
  selectedIds: Set<string>;
  mouseActive: boolean;
  listNumber?: number;
  previewType?: BlockType | null;

  // Prop for Drag & Drop Visuals
  dropTarget: { id: string; pos: "top" | "bottom" } | null;

  onInput: (id: string, html: string, text: string, el: HTMLDivElement) => void;
  onKeyDown: (e: React.KeyboardEvent, id: string) => void;
  onFocus: (id: string) => void;
  onMetaChange: (id: string, changes: Partial<Block>) => void;

  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (targetId: string) => void;

  onMouseDown: (id: string) => void;
  onMouseEnter: (id: string) => void;
}

const CODE_LANGUAGES = [
  "TypeScript",
  "JavaScript",
  "Java",
  "Python",
  "Docker",
  "HTML",
  "CSS",
  "C++",
  "Go",
  "Rust",
  "SQL",
  "JSON",
];

export default function BlockComponent({
  block,
  index,
  focusedId,
  selectedIds,
  mouseActive,
  listNumber,
  previewType,
  dropTarget,
  onInput,
  onKeyDown,
  onFocus,
  onMetaChange,
  onDragStart,
  onDragOver,
  onDrop,
  onMouseDown,
  onMouseEnter,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const isFocused = focusedId === block.id;
  const isSelected = selectedIds.has(block.id);
  const isDropTarget = dropTarget?.id === block.id;
  const dropPos = isDropTarget ? dropTarget.pos : null;

  const displayType = isFocused && previewType ? previewType : block.type;

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== block.text) {
      ref.current.innerHTML = block.text;
    }
  }, [block.text]);

  useEffect(() => {
    if (isFocused && ref.current && !isSelected) {
      ref.current.focus();
    }
  }, [isFocused, isSelected]);

  const showHandle = isHovered && mouseActive;

  let placeholder = "Type / for commands";
  if (displayType === "h1") placeholder = "Heading 1";
  if (displayType === "h2") placeholder = "Heading 2";
  if (displayType === "h3") placeholder = "Heading 3";
  if (displayType === "bullet-list" || displayType === "numbered-list")
    placeholder = "List";
  if (displayType === "quote") placeholder = "Quote";
  if (displayType === "code") placeholder = "";

  return (
    <div className="tree-node" style={{ position: "relative" }}>
      {/* Visual Drop Line Indicator */}
      {isDropTarget && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: "2px",
            backgroundColor: "#2eaadc",
            pointerEvents: "none",
            zIndex: 50,
            top: dropPos === "top" ? "-1px" : "auto",
            bottom: dropPos === "bottom" ? "-1px" : "auto",
            borderRadius: "1px",
            boxShadow: "0 0 4px #2eaadc",
          }}
        />
      )}

      <div
        ref={wrapperRef}
        id={block.id}
        className={`block-wrapper wrapper-${displayType} ${
          isSelected ? "selected" : ""
        }`}
        onMouseEnter={() => {
          setIsHovered(true);
          onMouseEnter(block.id);
        }}
        onMouseLeave={() => setIsHovered(false)}
        onMouseDown={() => onMouseDown(block.id)}
        draggable={false}
        onDragOver={(e) => {
          // Pass event to Editor to calculate top/bottom split
          onDragOver(e, block.id);
        }}
        onDrop={(e) => {
          e.stopPropagation();
          onDrop(block.id);
        }}
      >
        <div
          className="drag-handle"
          contentEditable={false}
          style={{ opacity: showHandle ? 1 : 0 }}
          draggable={true}
          onDragStart={(e) => {
            e.stopPropagation();
            onDragStart(block.id);
            if (wrapperRef.current) {
              e.dataTransfer.setDragImage(wrapperRef.current, 0, 0);
            }
          }}
        >
          <GripVertical size={18} />
        </div>

        <div className="block-content-container">
          {displayType === "code" && (
            <div className="code-lang-selector" contentEditable={false}>
              <select
                value={block.language || "TypeScript"}
                onChange={(e) =>
                  onMetaChange(block.id, { language: e.target.value })
                }
                onClick={(e) => e.stopPropagation()}
              >
                {CODE_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="select-icon" />
            </div>
          )}

          <div
            ref={ref}
            className={`block block-${displayType}`}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            data-placeholder={
              isFocused && !ref.current?.textContent ? placeholder : ""
            }
            data-list-number={listNumber}
            onInput={(e) =>
              onInput(
                block.id,
                e.currentTarget.innerHTML,
                e.currentTarget.textContent ?? "",
                e.currentTarget
              )
            }
            onKeyDown={(e) => onKeyDown(e, block.id)}
            onFocus={() => {
              if (!isFocused) onFocus(block.id);
            }}
          />
        </div>
      </div>

      {block.children.length > 0 && block.isOpen && (
        <div className="block-children">
          {block.children.map((child, i) => {
            let childListNum = 0;
            if (child.type === "numbered-list") {
              childListNum = i + 1;
            }

            return (
              <BlockComponent
                key={child.id}
                block={child}
                index={i}
                focusedId={focusedId}
                selectedIds={selectedIds}
                mouseActive={mouseActive}
                listNumber={childListNum}
                previewType={focusedId === block.id ? previewType : null}
                dropTarget={dropTarget}
                onInput={onInput}
                onKeyDown={onKeyDown}
                onFocus={onFocus}
                onMetaChange={onMetaChange}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onMouseDown={onMouseDown}
                onMouseEnter={onMouseEnter}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
