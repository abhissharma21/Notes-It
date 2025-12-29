import { useEffect, useRef, useState } from "react";
import { GripVertical, ChevronDown } from "lucide-react";
import type { Block } from "./types";

interface Props {
  block: Block;
  index: number;
  isFocused: boolean;
  mouseActive: boolean;

  onInput: (index: number, text: string, el: HTMLDivElement) => void;
  onKeyDown: (e: React.KeyboardEvent, index: number) => void;
  onFocus: (index: number) => void;
  onMetaChange: (index: number, changes: Partial<Block>) => void; // New prop

  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: () => void;
}

const CODE_LANGUAGES = [
  "JavaScript",
  "TypeScript",
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

export default function Block({
  block,
  index,
  isFocused,
  mouseActive,
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

  // Mount text once
  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = block.text;
    }
  }, []);

  // Handle focus
  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.focus();
    }
  }, [isFocused]);

  const showHandle = isHovered && mouseActive;

  // Dynamic placeholder
  let placeholder = "Type / for commands";
  if (block.type === "h1") placeholder = "Heading 1";
  if (block.type === "h2") placeholder = "Heading 2";
  if (block.type === "h3") placeholder = "Heading 3";
  if (block.type === "bullet-list" || block.type === "numbered-list")
    placeholder = "List";
  if (block.type === "quote") placeholder = "Quote";
  if (block.type === "code") placeholder = ""; // No placeholder for code, clear UI

  return (
    <div
      className="block-wrapper"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(index);
      }}
      onDrop={onDrop}
    >
      <div
        className="drag-handle"
        contentEditable={false}
        style={{ opacity: showHandle ? 1 : 0 }}
      >
        <GripVertical size={18} />
      </div>

      <div className="block-content-container">
        {/* Language Selector for Code Blocks */}
        {block.type === "code" && (
          <div className="code-lang-selector" contentEditable={false}>
            <select
              value={block.language || "TypeScript"}
              onChange={(e) =>
                onMetaChange(index, { language: e.target.value })
              }
              onClick={(e) => e.stopPropagation()} // Prevent block focus logic
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
          className={`block block-${block.type}`}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          data-placeholder={isFocused && !block.text ? placeholder : ""}
          onInput={(e) =>
            onInput(index, e.currentTarget.textContent ?? "", e.currentTarget)
          }
          onKeyDown={(e) => onKeyDown(e, index)}
          onFocus={() => onFocus(index)}
        />
      </div>
    </div>
  );
}
