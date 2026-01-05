import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Image as ImageIcon, Trash, AlignLeft, AlignCenter, AlignRight, AlertCircle, Type } from "lucide-react";
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
  const [caption, setCaption] = useState<InlineNode[]>(block.props.caption || []);
  const [error, setError] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  const captionRef = useRef<HTMLDivElement>(null);
  const captionCursorRef = useRef<number | null>(null);
  const widthRef = useRef<number>(width);

  useEffect(() => {
    if (block.props.src && block.props.src !== src) setSrc(block.props.src);
    if (block.props.width && block.props.width !== width) {
        setWidth(block.props.width);
        widthRef.current = block.props.width;
    }
    if (block.props.caption !== caption) setCaption(block.props.caption || []);
  }, [block.props]);

  useLayoutEffect(() => {
    if (captionCursorRef.current !== null && captionRef.current) {
        setCaretOffset(captionRef.current, captionCursorRef.current);
        captionCursorRef.current = null;
    }
  }, [caption]);

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

  const handleMouseDownResize = (e: React.MouseEvent, direction: "left" | "right") => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = widthRef.current;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const change = direction === "right" ? delta : -delta; 
      const newWidth = Math.max(100, Math.min(1200, startWidth + (change * 2)));
      setWidth(newWidth);
      widthRef.current = newWidth;
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setIsResizing(false);
      onUpdateMetadata(block.id, { props: { ...block.props, width: widthRef.current } });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleCaptionInput = (e: React.FormEvent<HTMLDivElement>) => {
    if (captionRef.current) {
        captionCursorRef.current = getCaretOffset(captionRef.current);
    }
    const newContent = parseDOMToContent(e.currentTarget, caption);
    
    const sanitizedContent = newContent.map(node => ({
        ...node,
        text: node.text.replace(/\n/g, "")
    })).filter(node => node.text.length > 0);

    setCaption(sanitizedContent);
    onUpdateMetadata(block.id, { props: { ...block.props, caption: sanitizedContent } });
  };

  const handleCaptionKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation(); 
    if (e.key === 'Enter') {
        e.preventDefault(); 
        if (captionRef.current) captionRef.current.blur();
        onAddParagraphBelow(block.id);
    }
  };

  const handleCaptionClick = () => {
    if (captionRef.current) captionRef.current.focus();
  };

  
  if (!src) {
    return (
      <div 
        className={`block-image-empty ${isFocused ? "focused" : ""}`}
        onMouseDown={(e) => { e.stopPropagation(); onSelectionChange(block.id, 0); }}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        <div className="image-placeholder">
          <ImageIcon size={20} style={{ color: "#9ca3af", marginRight: "10px" }} />
          <span style={{ fontSize: "15px", color: "#6b7280" }}>Add image</span>
        </div>
        
        
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileUpload} 
          onClick={(e) => e.stopPropagation()} 
          style={{
            position: 'absolute',
            top: 0, 
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,      
            cursor: 'pointer',
            zIndex: 10,
            fontSize: '0px'  
          }}
        />

        {isFocused && (
            <button 
                onMouseDown={(e) => e.stopPropagation()} 
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDeleteBlock(block.id); }}
                className="delete-btn-overlay"
                style={{ zIndex: 20 }}
            >
                <Trash size={14} />
            </button>
        )}
      </div>
    );
  }

  const currentAlign = block.props.align || "center";
  const captionKey = `caption-${caption.length}`;

  return (
    <div 
      className={`block-image-container ${isFocused ? "focused" : ""}`}
      onClick={(e) => { e.stopPropagation(); onSelectionChange(block.id, 0); }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: currentAlign === "left" ? "flex-start" : currentAlign === "right" ? "flex-end" : "center",
        position: "relative"
      }}
    >
 
      {isFocused && !isResizing && (
        <div className="image-toolbar" onMouseDown={e => e.stopPropagation()}>
          <button className={block.props.align === "left" ? "active" : ""} onClick={() => onUpdateMetadata(block.id, { props: { ...block.props, align: "left" } })}><AlignLeft size={16}/></button>
          <button className={block.props.align === "center" ? "active" : ""} onClick={() => onUpdateMetadata(block.id, { props: { ...block.props, align: "center" } })}><AlignCenter size={16}/></button>
          <button className={block.props.align === "right" ? "active" : ""} onClick={() => onUpdateMetadata(block.id, { props: { ...block.props, align: "right" } })}><AlignRight size={16}/></button>
          
          <div className="toolbar-divider" />
          
          <button onClick={handleCaptionClick} title="Add Caption">
             <Type size={16} />
          </button>

          <div className="toolbar-divider" />

          
          <div className="replace-image-wrapper" title="Replace Image">
             <input 
               type="file" 
               accept="image/*" 
               onChange={handleFileUpload} 
             />
             <ImageIcon size={16} />
          </div>

          <button onClick={() => onDeleteBlock(block.id)} className="delete" title="Delete Image">
              <Trash size={16}/>
          </button>
        </div>
      )}

      <div className="image-wrapper" style={{ width: width, maxWidth: '100%', position: 'relative' }}>
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

        {isFocused && (
           <>
               <div className="resize-handle-pill left" onMouseDown={(e) => handleMouseDownResize(e, "left")} />
               <div className="resize-handle-pill right" onMouseDown={(e) => handleMouseDownResize(e, "right")} />
           </>
        )}
      </div>

      <div className="caption-wrapper" style={{ width: width, maxWidth: '100%' }}>
         <div 
            key={captionKey}
            ref={captionRef}
            className="image-caption"
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Write a caption..."
            onInput={handleCaptionInput}
            onKeyDown={handleCaptionKeyDown}
            style={{ 
                textAlign: 'left', 
                color: '#888', 
                fontSize: '13px', 
                outline: 'none', 
                minHeight: '1.5em' 
            }}
         >
            <BlockContent content={caption} />
         </div>
      </div>
    </div>
  );
}