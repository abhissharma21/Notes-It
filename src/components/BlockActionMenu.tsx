import React, { useEffect, useRef } from "react";
import { Trash, Copy, Repeat, Type, Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code, Minus, Image as ImageIcon } from "lucide-react";
import type { BlockType } from "../types";

interface Props {
  position: { top: number; left: number };
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTurnInto: (type: BlockType) => void;
}

export default function BlockActionMenu({ position, onClose, onDelete, onDuplicate, onTurnInto }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const Item = ({ icon: Icon, label, onClick, danger }: any) => (
    <div 
      className={`menu-item ${danger ? "danger" : ""}`} 
      onClick={(e) => { e.stopPropagation(); onClick(); onClose(); }}
    >
      <Icon size={14} className="menu-icon" />
      <span>{label}</span>
    </div>
  );

  return (
    <div 
      ref={menuRef} 
      className="block-action-menu"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()} // Prevent focus stealing
    >
      <div className="menu-section">
        <Item icon={Trash} label="Delete" onClick={onDelete} danger />
        <Item icon={Copy} label="Duplicate" onClick={onDuplicate} />
      </div>
      
      <div className="menu-divider" />
      
      <div className="menu-label">Turn into</div>
      <div className="menu-section scrollable">
        <Item icon={Type} label="Text" onClick={() => onTurnInto("paragraph")} />
        <Item icon={Heading1} label="Heading 1" onClick={() => onTurnInto("heading")} /> 
        <Item icon={Heading2} label="Heading 2" onClick={() => onTurnInto("heading")} /> 
        <Item icon={Heading3} label="Heading 3" onClick={() => onTurnInto("heading")} /> 
        <Item icon={List} label="Bullet List" onClick={() => onTurnInto("bullet-list")} />
        <Item icon={ListOrdered} label="Numbered List" onClick={() => onTurnInto("numbered-list")} />
        <Item icon={Quote} label="Quote" onClick={() => onTurnInto("quote")} />
        <Item icon={Code} label="Code" onClick={() => onTurnInto("code")} />
        <Item icon={Minus} label="Divider" onClick={() => onTurnInto("divider")} />
      </div>
    </div>
  );
}