import { useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  ChevronDown,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Check,
} from "lucide-react";
import type { BlockType, MarkType } from "../types";

interface Props {
  onConvertBlock: (type: BlockType) => void;
  onToggleMark: (mark: MarkType) => void;
  onUpdateBlockAlign: (align: "left" | "center" | "right") => void;
  currentType: BlockType;
}

export default function InlineToolbar({
  onConvertBlock,
  onToggleMark,
  onUpdateBlockAlign,
  currentType,
}: Props) {
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setPosition(null);
        setShowTypeMenu(false);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width === 0) {
        setPosition(null);
        return;
      }

      // Calculate position above text
      const top = rect.top + window.scrollY - 50;
      const left = rect.left + window.scrollX + rect.width / 2;

      setPosition({ top, left });
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    // Also listen to scroll to update position
    document.addEventListener("scroll", handleSelectionChange);

    // Initial check
    handleSelectionChange();

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("scroll", handleSelectionChange);
    };
  }, []);

  if (!position) return null;

  const Button = ({ icon: Icon, onClick, active }: any) => (
    <button
      className={`toolbar-btn ${active ? "active" : ""}`}
      onMouseDown={(e) => {
        e.preventDefault(); // Prevent focus loss
        e.stopPropagation();
        onClick();
      }}
    >
      <Icon size={16} />
    </button>
  );

  const Divider = () => <div className="toolbar-divider" />;

  return (
    <div
      className="inline-toolbar"
      style={{
        top: position.top,
        left: position.left,
        transform: "translateX(-50%)",
      }}
      // Prevent focus loss when clicking toolbar background
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* 1. Type Selector */}
      <div className="toolbar-section relative">
        <button
          className="toolbar-btn text-dropdown-btn"
          onClick={() => setShowTypeMenu(!showTypeMenu)}
          onMouseDown={(e) => e.preventDefault()}
        >
          {currentType === "heading"
            ? "Heading"
            : currentType === "paragraph"
            ? "Text"
            : "Block"}
          <ChevronDown size={12} style={{ marginLeft: 4 }} />
        </button>

        {showTypeMenu && (
          <div className="toolbar-dropdown">
            <div
              className="dropdown-item"
              onMouseDown={() => onConvertBlock("paragraph")}
            >
              <Type size={14} /> <span>Text</span>{" "}
              {currentType === "paragraph" && <Check size={12} />}
            </div>
            <div
              className="dropdown-item"
              onMouseDown={() => onConvertBlock("h1")}
            >
              <Heading1 size={14} /> <span>Heading 1</span>
            </div>
            <div
              className="dropdown-item"
              onMouseDown={() => onConvertBlock("h2")}
            >
              <Heading2 size={14} /> <span>Heading 2</span>
            </div>
            <div
              className="dropdown-item"
              onMouseDown={() => onConvertBlock("h3")}
            >
              <Heading3 size={14} /> <span>Heading 3</span>
            </div>
          </div>
        )}
      </div>

      <Divider />

      {/* 2. Formatting */}
      <div className="toolbar-section">
        <Button icon={Bold} onClick={() => onToggleMark("bold")} />
        <Button icon={Italic} onClick={() => onToggleMark("italic")} />
        <Button icon={Underline} onClick={() => onToggleMark("underline")} />
        <Button icon={Strikethrough} onClick={() => onToggleMark("strike")} />
      </div>

      <Divider />

      {/* 3. Alignment */}
      <div className="toolbar-section">
        <Button icon={AlignLeft} onClick={() => onUpdateBlockAlign("left")} />
        <Button
          icon={AlignCenter}
          onClick={() => onUpdateBlockAlign("center")}
        />
        <Button icon={AlignRight} onClick={() => onUpdateBlockAlign("right")} />
      </div>

      {/* 4. Color / Link (Placeholders for now) */}
      <Divider />
      <div className="toolbar-section">
        <Button icon={LinkIcon} onClick={() => alert("Link coming soon")} />
      </div>
    </div>
  );
}
