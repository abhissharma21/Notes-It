import { useEffect, useRef, useState } from "react";
import { getPreview } from "../commands";
import type { Command } from "./types";

interface Props {
  position: { x: number; y: number };
  query: string;
  commands: Command[];
  selectedIndex: number;
  onSelect: (command: Command) => void;
  onClose: () => void;
}

export default function SlashMenu({
  position,
  query,
  commands,
  selectedIndex,
  onSelect,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: position.x, y: position.y });
  const selectedCommand = commands[selectedIndex];

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = position.x;
      let newY = position.y;

      if (newY + rect.height > window.innerHeight) {
        newY = position.y - rect.height - 30; 
      }

      if (newX + rect.width > window.innerWidth) {
        newX = window.innerWidth - rect.width - 20;
      }

      setCoords({ x: newX, y: newY });
    }
  }, [position, commands.length]);

  useEffect(() => {
    const listContainer = menuRef.current?.querySelector(".slash-list");
    const el = listContainer?.children[selectedIndex] as HTMLElement;
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <div
      ref={menuRef}
      className="slash-menu"
      style={{ top: coords.y, left: coords.x, position: 'fixed' }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="slash-list">
        {commands.length > 0 ? (
          commands.map((cmd, i) => (
            <div
              key={cmd.type}
              className={`slash-item ${i === selectedIndex ? "active" : ""}`}
              onClick={() => onSelect(cmd)}
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
          <div className="slash-empty">No matching commands</div>
        )}
      </div>

      <div className="slash-footer">
        <div className="slash-footer-section">
          <span className="slash-key">Type '/' on the page</span>
        </div>
        <div className="slash-footer-section">
          <span className="slash-key">esc</span> to dismiss
        </div>
      </div>

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