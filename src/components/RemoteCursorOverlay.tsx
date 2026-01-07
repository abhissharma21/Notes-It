import { useEffect, useState } from "react";
import type { RemoteCursor } from "../types";
import { getDomRectForBlockOffset } from "../utils";

interface Props {
  cursors: Record<string, RemoteCursor>;
}

export default function RemoteCursorOverlay({ cursors }: Props) {
  const [positions, setPositions] = useState<Record<string, { top: number; left: number; height: number }>>({});

  useEffect(() => {
    let animationFrameId: number;

    const updatePositions = () => {
      const newPositions: Record<string, any> = {};
      
      Object.values(cursors).forEach((cursor) => {
        // Only show if active within last 10 seconds
        if (Date.now() - cursor.lastActive > 10000) return;

        const rect = getDomRectForBlockOffset(cursor.blockId, cursor.offset);
        if (rect) {
          // Calculate position relative to the scrollable page
          // NOTE: If using a fixed editor container, might need to subtract container offset
          // Here we assume standard flow:
          newPositions[cursor.clientId] = {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            height: rect.height,
          };
        }
      });

      setPositions(newPositions);
      animationFrameId = requestAnimationFrame(updatePositions);
    };

    updatePositions();
    return () => cancelAnimationFrame(animationFrameId);
  }, [cursors]);

  return (
    <>
      {Object.values(cursors).map((cursor) => {
        const pos = positions[cursor.clientId];
        if (!pos) return null;

        return (
          <div
            key={cursor.clientId}
            className="remote-cursor"
            style={{
              top: pos.top,
              left: pos.left,
              height: pos.height,
              backgroundColor: cursor.color,
            }}
          >
            <div className="remote-cursor-label" style={{ backgroundColor: cursor.color }}>
              {cursor.name}
            </div>
          </div>
        );
      })}
    </>
  );
}