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
} from "lucide-react";
import type { BlockType, MarkType } from "../types";

interface Props {
  onConvertBlock: (type: BlockType) => void;
  onToggleMark: (mark: MarkType) => void; // <--- Changed from void to MarkType
  currentType: BlockType;
  onPreview: (type: BlockType | null) => void;
}

export default function InlineToolbar({
  onConvertBlock,
  onToggleMark,
  currentType,
  onPreview,
}: Props) {
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [showTextMenu, setShowTextMenu] = useState(false);

  useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setPosition(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width === 0) {
        setPosition(null);
        return;
      }

      // Calculate center position above selection
      const top = rect.top + window.scrollY - 45;
      const left = rect.left + window.scrollX + rect.width / 2 - 150; // Centered (approx width 300)

      setPosition({ top, left });
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  if (!position) return null;

  return (
    <div
      className="inline-toolbar"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
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
            {/* Simplified dropdown items for brevity - hook up onConvertBlock */}
            <div
              className="dropdown-item"
              onClick={() => onConvertBlock("paragraph")}
            >
              Text
            </div>
            <div className="dropdown-item" onClick={() => onConvertBlock("h1")}>
              Heading 1
            </div>
            <div className="dropdown-item" onClick={() => onConvertBlock("h2")}>
              Heading 2
            </div>
            <div
              className="dropdown-item"
              onClick={() => onConvertBlock("code")}
            >
              Code Block
            </div>
          </div>
        )}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-section">
        <button className="toolbar-btn" onClick={() => onToggleMark("bold")}>
          <Bold size={16} />
        </button>
        <button className="toolbar-btn" onClick={() => onToggleMark("italic")}>
          <Italic size={16} />
        </button>
        <button
          className="toolbar-btn"
          onClick={() => onToggleMark("underline")}
        >
          <Underline size={16} />
        </button>
        <button className="toolbar-btn" onClick={() => onToggleMark("code")}>
          <Code size={16} />
        </button>
      </div>
    </div>
  );
}
