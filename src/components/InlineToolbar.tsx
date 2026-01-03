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
  onConvertBlock: (type: string) => void;
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

      // --- POSITIONING LOGIC ---
      const TOOLBAR_WIDTH = 380;
      const GAP = 12;
      const VIEWPORT_WIDTH = window.innerWidth;

      let top = rect.top + window.scrollY - 40; // Default vertical align (above)
      let left = 0;

      // Vertical Center Alignment (Side positioning)
      const verticalCenter = rect.top + window.scrollY + rect.height / 2 - 20;

      // 1. Try RIGHT side
      if (rect.right + TOOLBAR_WIDTH + GAP < VIEWPORT_WIDTH) {
        left = rect.right + window.scrollX + GAP;
        top = verticalCenter; // Center vertically next to selection
      }
      // 2. Try LEFT side
      else if (rect.left - TOOLBAR_WIDTH - GAP > 0) {
        left = rect.left + window.scrollX - TOOLBAR_WIDTH - GAP;
        top = verticalCenter;
      }
      // 3. Fallback: Top Centered (Standard)
      else {
        left = rect.left + window.scrollX + rect.width / 2 - TOOLBAR_WIDTH / 2;
        top = rect.top + window.scrollY - 50;
      }

      setPosition({ top, left });
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("scroll", handleSelectionChange);

    handleSelectionChange(); // Initial check

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
        e.preventDefault();
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
        // Remove translate since we calculate exact pixels now
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
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

      <div className="toolbar-section">
        <Button icon={Bold} onClick={() => onToggleMark("bold")} />
        <Button icon={Italic} onClick={() => onToggleMark("italic")} />
        <Button icon={Underline} onClick={() => onToggleMark("underline")} />
        <Button icon={Strikethrough} onClick={() => onToggleMark("strike")} />
      </div>

      <Divider />

      <div className="toolbar-section">
        <Button icon={AlignLeft} onClick={() => onUpdateBlockAlign("left")} />
        <Button
          icon={AlignCenter}
          onClick={() => onUpdateBlockAlign("center")}
        />
        <Button icon={AlignRight} onClick={() => onUpdateBlockAlign("right")} />
      </div>

      <Divider />

      <div className="toolbar-section">
        <Button icon={LinkIcon} onClick={() => alert("Link coming soon")} />
      </div>
    </div>
  );
}
