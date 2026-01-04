import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import {
  Image as ImageIcon,
  Trash,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlertCircle,
  Type,
} from "lucide-react";
import type { Block, InlineNode } from "../types";
import { parseDOMToContent, getCaretOffset, setCaretOffset } from "../utils";
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
  const [caption, setCaption] = useState<InlineNode[]>(
    block.props.caption || []
  );
  const [error, setError] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Refs for logic
  const captionRef = useRef<HTMLDivElement>(null);
  const captionCursorRef = useRef<number | null>(null);
  const widthRef = useRef<number>(width); // Track width for resize logic

  // Sync props
  useEffect(() => {
    if (block.props.src && block.props.src !== src) setSrc(block.props.src);
    if (block.props.width && block.props.width !== width) {
      setWidth(block.props.width);
      widthRef.current = block.props.width;
    }
    // Note: We use block.props.align directly in render to avoid stale state issues
    if (block.props.caption !== caption) setCaption(block.props.caption || []);
  }, [block.props]);

  // --- CAPTION CURSOR RESTORATION (The "Right-to-Left" Fix) ---
  useLayoutEffect(() => {
    if (captionCursorRef.current !== null && captionRef.current) {
      setCaretOffset(captionRef.current, captionCursorRef.current);
      captionCursorRef.current = null;
    }
  }, [caption]); // Run whenever caption updates

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setSrc(url);
      setError(false);
      onUpdateMetadata(block.id, { props: { ...block.props, src: url } });
      onAddParagraphBelow(block.id);
    }
  };

  // --- RESIZE LOGIC (The "Snap Back" Fix) ---
  const handleMouseDownResize = (
    e: React.MouseEvent,
    direction: "left" | "right"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = widthRef.current; // Use ref for current truth

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const change = direction === "right" ? delta : -delta;
      const newWidth = Math.max(100, Math.min(1200, startWidth + change * 2));

      // Update State (Visual) AND Ref (Logic)
      setWidth(newWidth);
      widthRef.current = newWidth;
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setIsResizing(false);
      // Save the FINAL width from the Ref
      onUpdateMetadata(block.id, {
        props: { ...block.props, width: widthRef.current },
      });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleCaptionInput = (e: React.FormEvent<HTMLDivElement>) => {
    // 1. Save Cursor
    if (captionRef.current) {
      captionCursorRef.current = getCaretOffset(captionRef.current);
    }
    // 2. Parse Content
    const newContent = parseDOMToContent(e.currentTarget, caption);

    // 3. Update State (Triggers LayoutEffect)
    setCaption(newContent);
    onUpdateMetadata(block.id, {
      props: { ...block.props, caption: newContent },
    });
  };

  const handleCaptionClick = () => {
    if (captionRef.current) captionRef.current.focus();
  };

  // --- RENDER ---
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

  // Determine Alignment (Default to center for rendering, but check props for button active state)
  const currentAlign = block.props.align || "center";

  // Prevent crash by ensuring a key exists for the caption
  const captionKey = `caption-${caption.length}`;

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
        // Align the image wrapper itself
        alignItems:
          currentAlign === "left"
            ? "flex-start"
            : currentAlign === "right"
            ? "flex-end"
            : "center",
        position: "relative",
      }}
    >
      {/* TOOLBAR */}
      {isFocused && !isResizing && (
        <div className="image-toolbar" onMouseDown={(e) => e.stopPropagation()}>
          <button
            className={block.props.align === "left" ? "active" : ""}
            onClick={() =>
              onUpdateMetadata(block.id, {
                props: { ...block.props, align: "left" },
              })
            }
          >
            <AlignLeft size={16} />
          </button>

          <button
            className={block.props.align === "center" ? "active" : ""}
            onClick={() =>
              onUpdateMetadata(block.id, {
                props: { ...block.props, align: "center" },
              })
            }
          >
            <AlignCenter size={16} />
          </button>

          <button
            className={block.props.align === "right" ? "active" : ""}
            onClick={() =>
              onUpdateMetadata(block.id, {
                props: { ...block.props, align: "right" },
              })
            }
          >
            <AlignRight size={16} />
          </button>

          <div className="toolbar-divider" />

          <button onClick={handleCaptionClick} title="Add Caption">
            <Type size={16} />
          </button>

          <div className="toolbar-divider" />

          <div className="relative-wrapper" style={{ position: "relative" }}>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              style={{
                position: "absolute",
                opacity: 0,
                width: "100%",
                height: "100%",
                cursor: "pointer",
              }}
              title="Replace Image"
            />
            <button>
              <ImageIcon size={16} />
            </button>
          </div>

          <button onClick={() => onDeleteBlock(block.id)} className="delete">
            <Trash size={16} />
          </button>
        </div>
      )}

      {/* IMAGE */}
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

        {/* RESIZE HANDLES */}
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
          key={captionKey} // Force remount if length changes to prevent DOM mismatch
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
