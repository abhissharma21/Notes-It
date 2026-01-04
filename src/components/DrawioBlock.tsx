import React, { useRef, useState, useEffect, useCallback } from "react";
import { Image as ImageIcon, Trash, Edit2, Loader } from "lucide-react";
import type { Block } from "../types";

interface Props {
  block: Block;
  isFocused: boolean;
  onUpdateMetadata: (id: string, meta: Partial<Block>) => void;
  onDeleteBlock: (id: string) => void;
  onSelectionChange: (id: string, offset: number) => void;
  onAddParagraphBelow: (id: string) => void;
}

export default function DrawioBlock({
  block,
  isFocused,
  onUpdateMetadata,
  onDeleteBlock,
  onSelectionChange,
  onAddParagraphBelow,
}: Props) {
  const [xml, setXml] = useState<string>(block.props.xml || "");
  const [previewUrl, setPreviewUrl] = useState<string>(
    block.props.previewUrl || ""
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync props
  useEffect(() => {
    if (block.props.xml && block.props.xml !== xml) setXml(block.props.xml);
    if (block.props.previewUrl && block.props.previewUrl !== previewUrl)
      setPreviewUrl(block.props.previewUrl);
  }, [block.props.xml, block.props.previewUrl]);

  // Determine if we need to run the hidden generator
  // We need the iframe if: 1. User is editing OR 2. We have XML but no preview image yet
  const needsPreviewGeneration = xml && !previewUrl;
  const shouldRenderIframe = isEditing || needsPreviewGeneration;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content && content.length > 0) {
        // Update Local
        setXml(content);
        // Reset preview to force generation
        setPreviewUrl("");

        // Update Global
        onUpdateMetadata(block.id, {
          props: { ...block.props, xml: content, previewUrl: "" },
        });

        // Move Cursor
        onAddParagraphBelow(block.id);
      } else {
        alert("File appears empty.");
      }
    };
    reader.readAsText(file);
  };

  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow)
        return;

      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      switch (msg.event) {
        case "configure":
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({
              action: "configure",
              config: { css: ".geMenubar { display: none !important; }" },
            }),
            "*"
          );
          break;

        case "init":
          setIsLoading(false);
          // Load XML
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ action: "load", autosave: 1, xml: xml }),
            "*"
          );

          // If we are just generating a preview, request it immediately
          if (needsPreviewGeneration) {
            iframeRef.current.contentWindow?.postMessage(
              JSON.stringify({
                action: "export",
                format: "xmlsvg",
                spin: "Generating preview...",
              }),
              "*"
            );
          }
          break;

        case "autosave":
          // Whenever user saves in edit mode, regenerate preview
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ action: "export", format: "xmlsvg" }),
            "*"
          );
          break;

        case "export":
          if (msg.data) {
            setPreviewUrl(msg.data); // Update local to switch view immediately
            onUpdateMetadata(block.id, {
              props: {
                ...block.props,
                xml: msg.xml || xml,
                previewUrl: msg.data,
              },
            });
          }
          break;

        case "exit":
          setIsEditing(false);
          break;
      }
    },
    [xml, needsPreviewGeneration, block.id, onUpdateMetadata]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // --- 1. UPLOAD STATE ---
  if (!xml) {
    return (
      <div
        className={`block-drawio-empty ${isFocused ? "focused" : ""}`}
        onMouseDown={(e) => {
          e.stopPropagation();
          onSelectionChange(block.id, 0);
        }}
        style={{ position: "relative", overflow: "hidden" }}
      >
        <div className="drawio-placeholder">
          <ImageIcon
            size={20}
            style={{ color: "#9ca3af", marginRight: "10px" }}
          />
          <span style={{ fontSize: "15px", color: "#6b7280" }}>
            Add drawio diagram
          </span>
        </div>
        <input
          type="file"
          accept=".xml,.drawio"
          onChange={handleFileUpload}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: 0,
            cursor: "pointer",
            zIndex: 10,
            fontSize: "0px",
          }}
          title=""
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
            title="Delete Block"
            style={{ zIndex: 20 }}
          >
            <Trash size={14} />
          </button>
        )}
      </div>
    );
  }

  // --- 2. PREVIEW STATE (Standard) ---
  // Show this if we have a preview AND we are not editing
  if (!isEditing && previewUrl) {
    return (
      <div
        className={`block-drawio-preview ${isFocused ? "focused" : ""}`}
        onMouseDown={() => onSelectionChange(block.id, 0)}
        onDoubleClick={() => {
          setIsLoading(true);
          setIsEditing(true);
        }}
        style={{
          position: "relative",
          minHeight: "100px",
          backgroundColor: "#fff",
          borderRadius: "4px",
        }}
      >
        <img
          src={previewUrl}
          alt="Diagram Preview"
          style={{
            width: "100%",
            display: "block",
            borderRadius: "4px",
            pointerEvents: "none",
          }}
        />

        {isFocused && (
          <div className="drawio-controls">
            <button
              onClick={() => {
                setIsLoading(true);
                setIsEditing(true);
              }}
              className="edit-btn"
            >
              <Edit2 size={14} style={{ marginRight: 4 }} /> Edit
            </button>
            <button
              onClick={() => onDeleteBlock(block.id)}
              className="delete-btn"
            >
              <Trash size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- 3. IFRAME STATE (Editing OR Generating) ---
  return (
    <div
      className={`block-drawio-container ${isFocused ? "focused" : ""}`}
      style={{
        position: "relative",
        // If we are just generating a preview (not editing), hide the container physically but keep iframe alive
        height: needsPreviewGeneration ? "0px" : "500px",
        visibility: needsPreviewGeneration ? "hidden" : "visible",
        backgroundColor: "#fff",
        userSelect: "none",
      }}
    >
      {!needsPreviewGeneration && (
        <button onClick={() => setIsEditing(false)} className="close-edit-btn">
          Done
        </button>
      )}

      {/* Show loader only if actually editing, or we can show a mini loader placeholder if generating */}
      {isLoading && !needsPreviewGeneration && (
        <div className="drawio-loader">
          <Loader className="spin" size={24} />
          <span>Loading Editor...</span>
        </div>
      )}

      {/* If generating preview, show a temporary placeholder in place of the block */}
      {needsPreviewGeneration && (
        <div
          className="preview-placeholder"
          style={{ height: "150px", visibility: "visible" }}
        >
          <Loader className="spin" size={24} color="#666" />
          <span style={{ marginTop: 12, color: "#888", fontSize: "13px" }}>
            Generating Preview...
          </span>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src="https://embed.diagrams.net/?embed=1&ui=min&spin=1&proto=json&configure=1&fit=1&chrome=0&noSaveBtn=1&noExitBtn=1&saveAndExit=0"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          pointerEvents: "auto",
        }}
        title="Draw.io Editor"
      />
    </div>
  );
}
