import React, { useState, useRef, useEffect } from "react";
import {
  Image as ImageIcon,
  Trash,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlertCircle,
  Type,
  MoreHorizontal,
} from "lucide-react";
import type { Block, InlineNode } from "../types";
import { parseDOMToContent } from "../utils";
import BlockContent from "./BlockContent";

interface Props {
  block: Block;
  isFocused: boolean;
  onUpdateMetadata: (id: string, meta: Partial<Block>) => void;
  onDeleteBlock: (id: string) => void;
  onSelectionChange: (id: string, offset: number) => void;
  onAddParagraphBelow: (id: string) => void;
}

export default function ImageBlock({
  block,
  isFocused,
  onUpdateMetadata,
  onDeleteBlock,
  onSelectionChange,
  onAddParagraphBelow,
}: Props) {
  const [src, setSrc] = useState(block.props.src || "");
  const [width, setWidth] = useState<number>(block.props.width || 600);
  const [align, setAlign] = useState<"left" | "center" | "right">(
    block.props.align || "center"
  );
  const [caption, setCaption] = useState<InlineNode[]>(
    block.props.caption || []
  );
  const [error, setError] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const captionRef = useRef<HTMLDivElement>(null);
  const captionLength = caption.length;
  const captionKey = `caption-${captionLength}`;

  useEffect(() => {
    if (block.props.src && block.props.src !== src) setSrc(block.props.src);
    if (block.props.width && block.props.width !== width)
      setWidth(block.props.width);
    if (block.props.align && block.props.align !== align)
      setAlign(block.props.align);
  }, [block.props]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateImage(url);
    }
  };

  const updateImage = (url: string) => {
    setSrc(url);
    setError(false);
    onUpdateMetadata(block.id, { props: { ...block.props, src: url } });
    onAddParagraphBelow(block.id);
  };

  // --- RESIZE LOGIC ---
  const handleMouseDownResize = (
    e: React.MouseEvent,
    direction: "left" | "right"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      // If dragging left handle, delta needs to be inverted (moving left increases width)
      const change = direction === "right" ? delta : -delta;

      // Multiplier 2 makes centering resize feel natural (growing both sides)
      const newWidth = Math.max(100, Math.min(1200, startWidth + change * 2));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setIsResizing(false);
      onUpdateMetadata(block.id, { props: { ...block.props, width } });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleCaptionInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = parseDOMToContent(e.currentTarget, caption);
    setCaption(newContent);
    onUpdateMetadata(block.id, {
      props: { ...block.props, caption: newContent },
    });
  };

  const handleCaptionClick = () => {
    if (captionRef.current) {
      captionRef.current.focus();
    }
  };

  if (!src) {
    return (
      <div
        className={`block-image-empty ${isFocused ? "focused" : ""}`}
        onMouseDown={(e) => {
          e.stopPropagation();
          onSelectionChange(block.id, 0);
        }}
      >
        <div className="image-placeholder">
          <ImageIcon
            size={20}
            style={{ color: "#9ca3af", marginRight: "10px" }}
          />
          <span style={{ fontSize: "15px", color: "#6b7280" }}>Add image</span>
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="file-input-overlay"
        />
        {isFocused && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDeleteBlock(block.id);
            }}
            className="delete-btn-overlay"
          >
            <Trash size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`block-image-container ${isFocused ? "focused" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelectionChange(block.id, 0);
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems:
          align === "center"
            ? "center"
            : align === "right"
            ? "flex-end"
            : "flex-start",
        position: "relative",
      }}
    >
      {/* TOOLBAR */}
      {isFocused && !isResizing && (
        <div className="image-toolbar" onMouseDown={(e) => e.stopPropagation()}>
          <button
            className={align === "left" ? "active" : ""}
            onClick={() =>
              onUpdateMetadata(block.id, {
                props: { ...block.props, align: "left" },
              })
            }
          >
            <AlignLeft size={16} />
          </button>
          <button
            className={align === "center" ? "active" : ""}
            onClick={() =>
              onUpdateMetadata(block.id, {
                props: { ...block.props, align: "center" },
              })
            }
          >
            <AlignCenter size={16} />
          </button>
          <button
            className={align === "right" ? "active" : ""}
            onClick={() =>
              onUpdateMetadata(block.id, {
                props: { ...block.props, align: "right" },
              })
            }
          >
            <AlignRight size={16} />
          </button>

          <div className="toolbar-divider" />

          {/* Caption Button */}
          <button onClick={handleCaptionClick} title="Add Caption">
            <Type size={16} />
          </button>

          <div className="toolbar-divider" />

          <button onClick={() => onDeleteBlock(block.id)} className="delete">
            <Trash size={16} />
          </button>
        </div>
      )}

      {/* IMAGE WRAPPER */}
      <div
        className="image-wrapper"
        style={{ width: width, maxWidth: "100%", position: "relative" }}
      >
        {error ? (
          <div className="image-error">
            <AlertCircle size={24} />
            <span>Failed to load</span>
          </div>
        ) : (
          <img
            src={src}
            alt={block.props.alt || "Image"}
            onError={() => setError(true)}
            style={{ width: "100%", display: "block", borderRadius: "4px" }}
            draggable={false}
          />
        )}

        {/* PILL RESIZE HANDLES (Visible on Hover/Focus) */}
        {isFocused && (
          <>
            <div
              className="resize-handle-pill left"
              onMouseDown={(e) => handleMouseDownResize(e, "left")}
            />
            <div
              className="resize-handle-pill right"
              onMouseDown={(e) => handleMouseDownResize(e, "right")}
            />
          </>
        )}
      </div>

      {/* CAPTION */}
      <div
        className="caption-wrapper"
        style={{ width: width, maxWidth: "100%" }}
      >
        <div
          key={captionKey} // <--- Critical Fix for Caption
          ref={captionRef}
          className="image-caption"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Write a caption..."
          onInput={handleCaptionInput}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <BlockContent content={caption} />
        </div>
      </div>
    </div>
  );
}
