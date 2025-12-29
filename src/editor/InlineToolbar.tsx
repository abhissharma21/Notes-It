import { useEffect, useState, useRef } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Palette,
  ChevronDown,
  Type,
  Check,
  Merge,
  Split,
} from "lucide-react";
import type { BlockType } from "./types";

interface Props {
  onConvertBlock: (type: BlockType) => void;
  currentType: BlockType;
  onPreview: (type: BlockType | null) => void;

  // NEW: Modes for Text vs Block actions
  mode?: "text" | "block";
  staticPosition?: { top: number; left: number } | null;
  onMerge?: () => void;
  onSplit?: () => void;
  canSplit?: boolean;
}

export default function InlineToolbar({
  onConvertBlock,
  currentType,
  onPreview,
  mode = "text",
  staticPosition,
  onMerge,
  onSplit,
  canSplit,
}: Props) {
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showTextMenu, setShowTextMenu] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If we have a static position (for Block selection), use it directly
    if (staticPosition) {
      setPosition(staticPosition);
      setIsVisible(true);
      return;
    }

    // Otherwise, use Text Selection logic
    function handleSelectionChange() {
      if (mode === "block") return; // Don't use text selection logic in block mode

      const selection = window.getSelection();

      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setIsVisible(false);
        setShowTextMenu(false);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width === 0 || rect.height === 0) {
        setIsVisible(false);
        return;
      }

      const TOOLBAR_WIDTH = 280;
      const GAP = 12;

      const spaceRight = window.innerWidth - rect.right;

      let top = rect.top + window.scrollY - 8;
      let left = 0;

      if (spaceRight > TOOLBAR_WIDTH + GAP) {
        left = rect.right + window.scrollX + GAP;
      } else {
        left = rect.left + window.scrollX - TOOLBAR_WIDTH - GAP;
        if (left < 10) {
          left = window.innerWidth - TOOLBAR_WIDTH - 20;
          top = rect.bottom + window.scrollY + GAP;
        }
      }

      setPosition({ top, left });
      setIsVisible(true);
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, [mode, staticPosition]);

  function format(command: string, value?: string) {
    document.execCommand(command, false, value);
  }

  function handleSelect(type: BlockType) {
    onConvertBlock(type);
    setShowTextMenu(false);
  }

  if (!isVisible || !position) return null;

  // --- Render Block Action Menu ---
  if (mode === "block") {
    return (
      <div
        className="inline-toolbar"
        style={{ top: position.top, left: position.left }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="toolbar-section">
          {/* Merge Button */}
          <button
            className="toolbar-btn"
            onClick={onMerge}
            title="Merge Blocks"
            disabled={!onMerge}
          >
            <Merge size={16} />
            <span style={{ marginLeft: 4, fontSize: 13 }}>Merge</span>
          </button>
        </div>

        {/* Show Split only if allowed (e.g. single block selected with multiple lines) */}
        {canSplit && (
          <>
            <div className="toolbar-divider" />
            <div className="toolbar-section">
              <button
                className="toolbar-btn"
                onClick={onSplit}
                title="Split into multiple blocks"
              >
                <Split size={16} />
                <span style={{ marginLeft: 4, fontSize: 13 }}>Split</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // --- Render Text Formatting Menu (Standard) ---
  return (
    <div
      ref={menuRef}
      className="inline-toolbar"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="toolbar-section">
        <button
          className="toolbar-btn text-dropdown-btn"
          onClick={() => setShowTextMenu(!showTextMenu)}
        >
          <span style={{ marginRight: 4 }}>Text</span>
          <ChevronDown size={12} />
        </button>

        {showTextMenu && (
          <div className="toolbar-dropdown">
            <DropdownItem
              label="Text"
              icon={<Type size={14} />}
              isActive={currentType === "paragraph"}
              onClick={() => handleSelect("paragraph")}
              onHover={() => onPreview("paragraph")}
            />
            {/* ... other dropdown items ... */}
            <DropdownItem
              label="Heading 1"
              icon={
                <span style={{ fontWeight: "bold", fontSize: 14 }}>H1</span>
              }
              isActive={currentType === "h1"}
              onClick={() => handleSelect("h1")}
              onHover={() => onPreview("h1")}
            />
            <DropdownItem
              label="Heading 2"
              icon={
                <span style={{ fontWeight: "bold", fontSize: 13 }}>H2</span>
              }
              isActive={currentType === "h2"}
              onClick={() => handleSelect("h2")}
              onHover={() => onPreview("h2")}
            />
            <DropdownItem
              label="Bullet List"
              icon={<span>•</span>}
              isActive={currentType === "bullet-list"}
              onClick={() => handleSelect("bullet-list")}
              onHover={() => onPreview("bullet-list")}
            />
            <DropdownItem
              label="Numbered List"
              icon={<span>1.</span>}
              isActive={currentType === "numbered-list"}
              onClick={() => handleSelect("numbered-list")}
              onHover={() => onPreview("numbered-list")}
            />
            <DropdownItem
              label="Code Block"
              icon={<Code size={14} />}
              isActive={currentType === "code"}
              onClick={() => handleSelect("code")}
              onHover={() => onPreview("code")}
            />
          </div>
        )}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button className="toolbar-btn" onClick={() => format("bold")}>
          <Bold size={16} />
        </button>
        <button className="toolbar-btn" onClick={() => format("italic")}>
          <Italic size={16} />
        </button>
        <button className="toolbar-btn" onClick={() => format("underline")}>
          <Underline size={16} />
        </button>
        <button className="toolbar-btn" onClick={() => format("strikeThrough")}>
          <Strikethrough size={16} />
        </button>
        <button
          className="toolbar-btn"
          onClick={() => format("formatBlock", "PRE")}
        >
          <Code size={16} />
        </button>
      </div>

      {/* Option to split current block if it contains newlines, even in text mode? */}
      {canSplit && (
        <>
          <div className="toolbar-divider" />
          <button className="toolbar-btn" onClick={onSplit} title="Split Block">
            <Split size={16} />
          </button>
        </>
      )}

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button
          className="toolbar-btn"
          onClick={() => {
            const url = prompt("Enter link URL:");
            if (url) format("createLink", url);
          }}
        >
          <LinkIcon size={16} />
        </button>
        <button className="toolbar-btn">
          <Palette size={16} />
        </button>
      </div>
    </div>
  );
}

function DropdownItem({
  label,
  icon,
  isActive,
  onClick,
  onHover,
}: {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  onHover: () => void;
}) {
  return (
    <div className="dropdown-item" onClick={onClick} onMouseEnter={onHover}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        <div style={{ width: 16, display: "flex", justifyContent: "center" }}>
          {icon}
        </div>
        <span>{label}</span>
      </div>
      {isActive && <Check size={14} style={{ color: "#2eaadc" }} />}
    </div>
  );
}
