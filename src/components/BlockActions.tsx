import React from "react";
import { Plus, GripVertical } from "lucide-react";

interface Props {
  blockId: string;
  onAddBlock: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onMenuClick: (e: React.MouseEvent) => void;
}

export default function BlockActions({ blockId, onAddBlock, onDragStart, onMenuClick }: Props) {
  return (
    <div className="block-actions" contentEditable={false}>
      {/* Plus Button */}
      <div 
        className="action-btn plus-btn" 
        onClick={(e) => {
           e.stopPropagation();
           onAddBlock();
        }}
        title="Click to add a block below"
      >
        <Plus size={16} />
      </div>

      {/* Drag Handle / Menu Trigger */}
      <div 
        className="action-btn drag-btn drag-handle" 
        draggable
        onDragStart={onDragStart}
        onMouseDown={(e) => {
            // Prevent focus loss on simple click, but allow drag
            if (e.button === 0) e.stopPropagation(); 
        }}
        onClick={onMenuClick}
        title="Drag to move, Click for menu"
      >
        <GripVertical size={16} />
      </div>
    </div>
  );
}