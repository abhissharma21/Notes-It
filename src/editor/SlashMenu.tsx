import { useEffect, useRef } from "react";
import type { Command } from "./types";
import { getPreview } from "./commands";

interface Props {
  position: { x: number; y: number };
  query: string;
  commands: Command[];
  selectedIndex: number;
  onSelect: (command: Command) => void;
  onClose: () => void; // Used for click-outside check logic if needed
}

export default function SlashMenu({
  position,
  query,
  commands,
  selectedIndex,
  onSelect,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedCommand = commands[selectedIndex];

  // Auto-scroll to selected item
  useEffect(() => {
    const el = menuRef.current?.children[1]?.children[
      selectedIndex
    ] as HTMLElement; // [0] is header, [1] is list
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <div
      ref={menuRef}
      className="slash-menu"
      style={{ top: position.y, left: position.x }}
      onMouseDown={(e) => e.preventDefault()} // Prevent focus loss
    >
      {/* 1. Filter Header (always shows current query) */}
      <div className="slash-header">
        <span className="slash-header-text">
          /{query || "Type a command..."}
        </span>
      </div>

      {/* 2. Command List */}
      <div className="slash-list">
        {commands.length > 0 ? (
          commands.map((cmd, i) => (
            <div
              key={cmd.type}
              className={`slash-item ${i === selectedIndex ? "active" : ""}`}
              onClick={() => onSelect(cmd)}
              onMouseEnter={() => {
                // Optional: Hover syncs index?
                // Usually handled by parent keydown, but mouse hover nice-to-have
              }}
            >
              <div className="slash-item-left">
                <cmd.icon size={16} className="slash-icon" />
                <div className="slash-label-container">
                  <span className="slash-item-label">{cmd.label}</span>
                </div>
              </div>

              {cmd.shortcut && (
                <span className="slash-shortcut">{cmd.shortcut}</span>
              )}
            </div>
          ))
        ) : (
          // "If no filter is present do not show no result found just show the filter value"
          // The header handles showing the filter value. We just render empty list body.
          <div className="slash-empty">No matching commands</div>
        )}
      </div>

      {/* 3. Footer */}
      <div className="slash-footer">
        <div className="slash-footer-section">
          <span className="slash-key">Type '/' on the page</span>
        </div>
        <div className="slash-footer-section">
          <span className="slash-key">esc</span> to dismiss
        </div>
      </div>

      {/* 4. Preview Side Panel */}
      {selectedCommand && (
        <div className="slash-preview">
          {getPreview(selectedCommand)}
          <div className="preview-desc">
            <div className="preview-desc-title">
              {selectedCommand.label}{" "}
              <span className="preview-shortcut">
                {selectedCommand.shortcut}
              </span>
            </div>
            <div className="preview-desc-text">
              {selectedCommand.description}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
