import { useEffect, useRef, useState } from "react";
import { GripVertical, ChevronDown } from "lucide-react";
import type { Block, BlockType } from "./types";

interface Props {
  block: Block;
  // Index is now relative to siblings, not global
  index: number;
  // We pass the focused ID to check focus, rather than a boolean
  focusedId: string | null;
  mouseActive: boolean;
  listNumber?: number;
  previewType?: BlockType | null;

  // Actions now take ID instead of Index
  onInput: (id: string, html: string, text: string, el: HTMLDivElement) => void;
  onKeyDown: (e: React.KeyboardEvent, id: string) => void;
  onFocus: (id: string) => void;
  onMetaChange: (id: string, changes: Partial<Block>) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (targetId: string) => void;
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
  mouseActive,
  listNumber,
  previewType,
  onInput,
  onKeyDown,
  onFocus,
  onMetaChange,
  onDragStart,
  onDragOver,
  onDrop,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const isFocused = focusedId === block.id;

  // Determine display type (for previewing hover states)
  const displayType = isFocused && previewType ? previewType : block.type;

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== block.text) {
      ref.current.innerHTML = block.text;
    }
  }, [block.text]);

  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus();
      // Keep cursor at end is usually default behavior for contentEditable focus in some browsers,
      // but robust cursor management often needs explicit range handling (omitted for brevity).
    }
  }, [isFocused]);

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
    <div className="tree-node">
      <div
        className={`block-wrapper wrapper-${displayType}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart(block.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
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
              // Only trigger focus if not already
              if (!isFocused) onFocus(block.id);
            }}
          />
        </div>
      </div>

      {/* RECURSIVE CHILDREN RENDERING */}
      {block.children.length > 0 && block.isOpen && (
        <div className="block-children">
          {block.children.map((child, i) => {
            // Basic list numbering for children
            let childListNum = 0;
            if (child.type === "numbered-list") {
              // This logic is simplified; real numbering needs to check previous siblings in the child array
              // For now, we just count index + 1 if previous was list.
              // A proper implementation uses a reducer.
              childListNum = i + 1;
            }

            return (
              <BlockComponent
                key={child.id}
                block={child}
                index={i}
                focusedId={focusedId}
                mouseActive={mouseActive}
                listNumber={childListNum}
                previewType={previewType} // Pass preview down
                onInput={onInput}
                onKeyDown={onKeyDown}
                onFocus={onFocus}
                onMetaChange={onMetaChange}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
