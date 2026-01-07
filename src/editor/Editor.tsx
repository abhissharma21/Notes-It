import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import BlockComponent from "../components/Block";
import SlashMenu from "../components/SlashMenu";
import InlineToolbar from "../components/InlineToolbar";
import BlockActionMenu from "../components/BlockActionMenu";
import RemoteCursorOverlay from "../components/RemoteCursorOverlay"; // Import Overlay
import {
  createBlock,
  flattenBlocks,
  findNodePath,
  updateBlockInTree,
  insertAfterInTree,
  insertBeforeInTree,
  deleteBlockFromTree,
  getTextLength,
  sanitizeBlock,
  normalizeEditorState,
  toggleMarkInRange,
  duplicateBlock,
  applyOp,
} from "../utils";
import { COMMANDS } from "../commands";
import type { Block, BlockType, InlineNode, EditorSelection, MarkType, EditorOp } from "../types";
import { useHistory } from "../hooks/useHistory";
import { useCollab } from "../hooks/useCollab";

const getPlainText = (content: InlineNode[]) =>
  content.map((n) => n.text).join("");

export default function Editor() {
  const [initialBlock] = useState(() => ({
    ...createBlock("paragraph", ""),
    id: "shared-root-block" 
  }));

  const {
    state: blocks,
    set: setBlocksRaw,
    undo,
    redo,
    saveSnapshot,
  } = useHistory<Block[]>([initialBlock]);

  const blocksRef = useRef(blocks);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  const setBlocks = (newBlocks: Block[], save: boolean) => {
    blocksRef.current = newBlocks;
    const normalized = normalizeEditorState(newBlocks);
    setBlocksRaw(normalized, save);
  };

  const [focusedId, setFocusedId] = useState<string | null>(initialBlock.id);
  const [selection, setSelection] = useState<EditorSelection | null>({
    start: { blockId: initialBlock.id, offset: 0 },
    end: { blockId: initialBlock.id, offset: 0 },
    isCollapsed: true,
  });

  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    pos: "top" | "bottom";
  } | null>(null);

  const [slashMenu, setSlashMenu] = useState<{
    open: boolean;
    blockId: string | null;
    query: string;
    selectedIndex: number;
    x: number;
    y: number;
    top: number;
  }>({
    open: false,
    blockId: null,
    query: "",
    selectedIndex: 0,
    x: 0,
    y: 0,
    top: 0,
  });

  const [blockMenu, setBlockMenu] = useState<{ open: boolean; blockId: string | null; x: number; y: number; }>({
      open: false, blockId: null, x: 0, y: 0
  });

  const [isTyping, setIsTyping] = useState(false);
  const [previewType, setPreviewType] = useState<BlockType | null>(null);

  const flatBlocks = useMemo(() => flattenBlocks(blocks), [blocks]);

  const dispatch = useCallback((op: EditorOp, applyLocally: boolean, broadcast: boolean) => {
    if (applyLocally) {
      const currentBlocks = blocksRef.current;
      const newBlocks = applyOp(currentBlocks, op);
      setBlocks(newBlocks, false);
    }
    
    if (broadcast) {
      broadcastOp(op);
    }
  }, [blocksRef]);

  // Use Collab Hook with Cursor Support
  const { broadcastOp, broadcastCursor, remoteCursors } = useCollab((op) => {
    dispatch(op, true, false);
  });

  // Broadcast Cursor on Selection Change
  useEffect(() => {
    if (selection && selection.isCollapsed) {
      broadcastCursor(selection.start.blockId, selection.start.offset);
    }
  }, [selection, broadcastCursor]);

  useEffect(() => {
    function onMouseMove() {
      if (isTyping) setIsTyping(false);
    }
    function onWindowClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (slashMenu.open && !target.closest(".slash-menu")) {
        setSlashMenu((prev) => ({ ...prev, open: false }));
      }
      if (blockMenu.open && !target.closest(".block-action-menu") && !target.closest(".drag-handle")) {
        setBlockMenu(prev => ({ ...prev, open: false }));
      }
    }
    function onDragEnd() {
      setDragId(null);
      setDropTarget(null);
    }

    const handleGlobalSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);
      let target = range.startContainer.parentElement;
      while (target && !target.id) {
        target = target.parentElement;
      }
      
      const blockId = target?.id;

      if (blockId) {
        if (!sel.isCollapsed) {
          setFocusedId(blockId);
          setSelection({
            start: { blockId, offset: range.startOffset },
            end: { blockId, offset: range.endOffset },
            isCollapsed: false,
          });
        } else {
          setSelection({
            start: { blockId, offset: range.startOffset },
            end: { blockId, offset: range.endOffset },
            isCollapsed: true,
          });
        }
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onWindowClick);
    document.addEventListener("dragend", onDragEnd);
    document.addEventListener("selectionchange", handleGlobalSelection);
    
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onWindowClick);
      document.removeEventListener("dragend", onDragEnd);
      document.removeEventListener("selectionchange", handleGlobalSelection);
    };
  }, [slashMenu.open, isTyping, blockMenu.open]);

  useEffect(() => {
    function onWindowKeyDown(e: KeyboardEvent) {
      if (!isTyping) setIsTyping(true);
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if (e.key === "Escape") {
        setSlashMenu(prev => ({ ...prev, open: false }));
        setBlockMenu(prev => ({ ...prev, open: false }));
      }
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [undo, redo, isTyping]);

  const handleUpdateContent = (id: string, content: InlineNode[]) => {
    const newText = getPlainText(content);
    const currentFlat = flattenBlocks(blocksRef.current);
    const oldBlock = currentFlat.find(b => b.id === id);
    const oldText = oldBlock ? getPlainText(oldBlock.content) : "";

    if (newText.length > oldText.length) {
      const diff = newText.length - oldText.length;
      const offset = selection?.start.offset ?? oldText.length; 
      const safeOffset = Math.min(offset, oldText.length);
      const char = newText.slice(safeOffset, safeOffset + diff);
      
      dispatch({
        type: "insert_text",
        blockId: id,
        offset: safeOffset,
        text: char
      }, false, true); 

    } else if (newText.length < oldText.length) {
      const diff = oldText.length - newText.length;
      const offset = selection?.start.offset ?? (oldText.length - diff);
      
      dispatch({
        type: "delete_text",
        blockId: id,
        offset: offset,
        length: diff
      }, false, true); 
    }

    const newBlocks = updateBlockInTree(blocksRef.current, id, (b) => ({ ...b, content }));
    setBlocks(newBlocks, false);

    // Broadcast cursor position while typing
    const newOffset = (selection?.start.offset ?? 0) + (newText.length - oldText.length);
    broadcastCursor(id, newOffset);

    if (newText.includes("/")) {
      setTimeout(() => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          let rect = range.getBoundingClientRect();

          if (rect.left === 0 && rect.top === 0) {
            const clientRects = range.getClientRects();
            if (clientRects.length > 0) rect = clientRects[0];
          }
          
          const lastSlashIndex = newText.lastIndexOf("/");
          const queryText = newText.slice(lastSlashIndex + 1);

          setSlashMenu({
            open: true,
            blockId: id,
            query: queryText,
            selectedIndex: 0,
            x: rect.left,
            y: rect.bottom + 4,
            top: rect.top,
          });
        }
      }, 0);
    } else {
      if (slashMenu.open) setSlashMenu((prev) => ({ ...prev, open: false }));
    }
  };

  // ... (Keep handleUpdateMetadata, handleSelectionChange, handleToggleMark as is)
  // ... (Keep handleInlineBlockConversion, handleUpdateBlockAlign as is)
  // ... (Keep handleAddParagraphBelow, handleDeleteBlock as is)
  // ... (Keep handleKeyDown, applySlashCommand, drag/drop handlers as is)
  
  // NOTE: Re-paste the rest of the file logic from previous steps here 
  // (omitted for brevity since the change was just adding RemoteCursorOverlay and broadcastCursor calls)
  
  // ... Paste logic from previous Editor.tsx ...
  const handleUpdateMetadata = (id: string, meta: Partial<Block>) => {
    saveSnapshot();
    dispatch({
      type: "update_block_props",
      blockId: id,
      props: meta.props || {}
    }, true, true);
  };

  const handleSelectionChange = (id: string, offset: number) => {
    setFocusedId(id);
  };

  const handleToggleMark = (mark: MarkType) => {
    if (!selection || selection.isCollapsed) return;
    saveSnapshot();

    const { start, end } = selection;
    if (start.blockId === end.blockId) {
      const blockId = start.blockId;
      const block = flatBlocks.find((b) => b.id === blockId);
      if (block) {
        const newContent = toggleMarkInRange(
          block.content,
          start.offset,
          end.offset,
          mark
        );
        const newBlocks = updateBlockInTree(blocksRef.current, blockId, (b) => ({
          ...b,
          content: newContent,
        }));
        setBlocks(newBlocks, false);
      }
    }
  };

  const handleInlineBlockConversion = (cmdType: string, targetBlockId?: string) => {
    const id = targetBlockId || focusedId;
    if (!id) return;

    saveSnapshot();
    setPreviewType(null);

    let newType: BlockType = cmdType as BlockType;
    let newProps: any = {};

    if (cmdType === "h1") { newType = "heading"; newProps = { level: 1 }; }
    else if (cmdType === "h2") { newType = "heading"; newProps = { level: 2 }; }
    else if (cmdType === "h3") { newType = "heading"; newProps = { level: 3 }; }
    else if (cmdType === "code") { newType = "code"; newProps = { language: "TypeScript" }; }
    else if (cmdType === "bullet-list") newType = "bullet-list";
    else if (cmdType === "numbered-list") newType = "numbered-list";
    else if (cmdType === "quote") newType = "quote";
    if (cmdType === "paragraph") { newType = "paragraph"; }

    dispatch({
        type: "update_block_props",
        blockId: id,
        props: newProps
    }, true, true);
    
    dispatch({
        type: "set_block_type",
        blockId: id,
        newType
    }, true, true);
  };

  const handleUpdateBlockAlign = (align: "left" | "center" | "right") => {
    if (!focusedId) return;
    saveSnapshot();
    dispatch({
        type: "update_block_props",
        blockId: focusedId,
        props: { align }
    }, true, true);
  };

  const handleAddParagraphBelow = (blockId: string) => {
    saveSnapshot();
    const newBlock = createBlock("paragraph");
    dispatch({
        type: "add_block",
        block: newBlock,
        afterBlockId: blockId,
        parentId: null
    }, true, true);
    
    setTimeout(() => {
        setFocusedId(newBlock.id);
        setSelection({
          start: { blockId: newBlock.id, offset: 0 },
          end: { blockId: newBlock.id, offset: 0 },
          isCollapsed: true,
        });
    }, 0);
  };

  const handleDeleteBlock = (id: string) => {
    saveSnapshot();
    const currentFlat = flattenBlocks(blocksRef.current);
    const index = currentFlat.findIndex((b) => b.id === id);
    const prev = index > 0 ? currentFlat[index - 1] : null;
    const next = index < currentFlat.length - 1 ? currentFlat[index + 1] : null;

    dispatch({
      type: "delete_block",
      blockId: id
    }, true, true);

    if (blocksRef.current.length <= 1) { 
       const newBlock = createBlock("paragraph");
       dispatch({
         type: "add_block",
         block: newBlock,
         afterBlockId: null,
         parentId: null
       }, true, true);
       setFocusedId(newBlock.id);
       return;
    }

    if (prev) {
      const len = getTextLength(prev.content);
      setFocusedId(prev.id);
      setSelection({
        start: { blockId: prev.id, offset: len },
        end: { blockId: prev.id, offset: len },
        isCollapsed: true,
      });
    } else if (next) {
      setFocusedId(next.id);
      setSelection({
        start: { blockId: next.id, offset: 0 },
        end: { blockId: next.id, offset: 0 },
        isCollapsed: true,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    const currentFlat = flattenBlocks(blocksRef.current);
    const currentIndex = currentFlat.findIndex((b) => b.id === id);
    const block = currentFlat[currentIndex];

    if (e.metaKey || e.ctrlKey) {
      const key = e.key.toLowerCase();
      if (key === "b") { e.preventDefault(); handleToggleMark("bold"); return; }
      if (key === "i") { e.preventDefault(); handleToggleMark("italic"); return; }
      if (key === "u") { e.preventDefault(); handleToggleMark("underline"); return; }
      if (key === "e") { e.preventDefault(); handleToggleMark("code"); return; }
    }

    if (e.key === "Tab") {
      e.preventDefault();
      saveSnapshot();
      if (e.shiftKey) return;
      if (currentIndex > 0) {
        const prevBlock = currentFlat[currentIndex - 1];
        
        dispatch({ type: "delete_block", blockId: id }, true, true);
        
        let tempTree = deleteBlockFromTree(blocksRef.current, id);
        tempTree = updateBlockInTree(tempTree, prevBlock.id, (parent) => ({
            ...parent,
            isOpen: true,
            children: [...parent.children, block]
        }));
        setBlocks(tempTree, false);
        
        setTimeout(() => setFocusedId(id), 0);
      }
      return;
    }

    if (slashMenu.open && slashMenu.blockId === id) {
      const filtered = COMMANDS.filter((c) =>
        c.label.toLowerCase().includes(slashMenu.query.toLowerCase())
      );
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashMenu((s) => ({
          ...s,
          selectedIndex: (s.selectedIndex + 1) % filtered.length,
        }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashMenu((s) => ({
          ...s,
          selectedIndex:
            (s.selectedIndex - 1 + filtered.length) % filtered.length,
        }));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (filtered.length > 0)
          applySlashCommand(filtered[slashMenu.selectedIndex].type);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashMenu((s) => ({ ...s, open: false }));
        return;
      }
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (currentIndex > 0) setFocusedId(currentFlat[currentIndex - 1].id);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (currentIndex < currentFlat.length - 1)
        setFocusedId(currentFlat[currentIndex + 1].id);
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveSnapshot();

      if (block.type === "drawio" || block.type === "divider" || block.type === "image") {
          handleAddParagraphBelow(id); 
          return;
      }

      const contentLen = getTextLength(block.content);
      const isList = ["bullet-list", "numbered-list"].includes(block.type);

      if (isList && contentLen === 0) {
        dispatch({
            type: "set_block_type",
            blockId: id,
            newType: "paragraph"
        }, true, true);
        return;
      }

      const nextType = isList ? block.type : "paragraph";
      const newBlock = createBlock(nextType);
      
      dispatch({
          type: "add_block",
          block: newBlock,
          afterBlockId: id,
          parentId: null
      }, true, true);

      setFocusedId(newBlock.id);
      setSelection({
        start: { blockId: newBlock.id, offset: 0 },
        end: { blockId: newBlock.id, offset: 0 },
        isCollapsed: true,
      });
    }

    if (e.key === "Backspace") {
      const length = getTextLength(block.content);
      if (length === 0 && blocksRef.current.length > 1) {
        e.preventDefault();
        saveSnapshot();
        const prevIndex = currentIndex - 1;

        if (prevIndex >= 0) {
          const prevBlock = currentFlat[prevIndex];
          const prevLength = getTextLength(prevBlock.content);

          dispatch({
              type: "delete_block",
              blockId: id
          }, true, true);

          setFocusedId(prevBlock.id);
          setSelection({
            start: { blockId: prevBlock.id, offset: prevLength },
            end: { blockId: prevBlock.id, offset: prevLength },
            isCollapsed: true,
          });
        }
      }
    }
  };

  const applySlashCommand = (cmdType: string) => {
    if (!slashMenu.blockId) return;
    saveSnapshot();

    let newType: BlockType = cmdType as BlockType;
    let newProps: any = {};

    if (cmdType === "h1") { newType = "heading"; newProps = { level: 1 }; }
    else if (cmdType === "h2") { newType = "heading"; newProps = { level: 2 }; }
    else if (cmdType === "h3") { newType = "heading"; newProps = { level: 3 }; }
    else if (cmdType === "code") { newType = "code"; newProps = { language: "TypeScript" }; }
    else if (cmdType === "bullet-list") newType = "bullet-list";
    else if (cmdType === "numbered-list") newType = "numbered-list";
    else if (cmdType === "quote") newType = "quote";
    else if (cmdType === "divider") newType = "divider";
    else if (cmdType === "image") { newType = "image"; newProps = { src: "", width: 600, align: "center" }; }
    else if (cmdType === "drawio") { newType = "drawio"; newProps = { xml: "" }; }

    dispatch({
        type: "update_block_props",
        blockId: slashMenu.blockId,
        props: newProps
    }, true, true);
    
    dispatch({
        type: "set_block_type",
        blockId: slashMenu.blockId,
        newType
    }, true, true);
    
    const isVoid = newType === "drawio" || newType === "divider" || newType === "image";
    
    if (isVoid) {
         const newBlock = createBlock("paragraph");
         dispatch({
             type: "add_block",
             block: newBlock,
             afterBlockId: slashMenu.blockId,
             parentId: null
         }, true, true);
         
         setTimeout(() => {
            setFocusedId(newBlock.id);
            setSelection({
              start: { blockId: newBlock.id, offset: 0 },
              end: { blockId: newBlock.id, offset: 0 },
              isCollapsed: true,
            });
        }, 0);
    }

    setSlashMenu((s) => ({ ...s, open: false }));
  };

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pos = y < rect.height / 2 ? "top" : "bottom";
    setDropTarget({ id, pos });
  };
  const handleDrop = (targetId: string) => {
    if (!dragId || !dropTarget) return;
    if (dragId === targetId) {
      setDragId(null);
      setDropTarget(null);
      return;
    }
    saveSnapshot();
    const result = findNodePath(blocksRef.current, dragId);
    if (!result) return;
    const sourceBlock = result.node;
    
    dispatch({ type: "delete_block", blockId: dragId }, true, true);
    dispatch({
        type: "add_block",
        block: sourceBlock,
        afterBlockId: dropTarget.pos === "bottom" ? targetId : null, 
        parentId: null
    }, true, true);
    
    setDragId(null);
    setDropTarget(null);
  };

  const handleOpenBlockMenu = (e: React.MouseEvent, blockId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setBlockMenu({
          open: true,
          blockId,
          x: e.clientX,
          y: e.clientY
      });
  };

  const handleDuplicateBlock = () => {
      if (!blockMenu.blockId) return;
      saveSnapshot();
      const result = findNodePath(blocksRef.current, blockMenu.blockId);
      if (result) {
          const clone = duplicateBlock(result.node);
          dispatch({
              type: "add_block",
              block: clone,
              afterBlockId: blockMenu.blockId,
              parentId: null
          }, true, true);
      }
      setBlockMenu(prev => ({ ...prev, open: false }));
  };

  const handleAddBlockAndOpenSlash = (blockId: string) => {
      saveSnapshot();
      const newBlock = createBlock("paragraph");
      
      dispatch({
          type: "add_block",
          block: newBlock,
          afterBlockId: blockId,
          parentId: null
      }, true, true);
      
      setTimeout(() => {
          setFocusedId(newBlock.id);
          setSelection({ start: { blockId: newBlock.id, offset: 0 }, end: { blockId: newBlock.id, offset: 0 }, isCollapsed: true });
          
          const el = document.getElementById(newBlock.id);
          if (el) {
              const rect = el.getBoundingClientRect();
              setSlashMenu({
                  open: true,
                  blockId: newBlock.id,
                  query: "",
                  selectedIndex: 0,
                  x: rect.left,
                  y: rect.bottom,
                  top: rect.top,
              });
          }
      }, 10);
  };

  const filteredCommands = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(slashMenu.query.toLowerCase())
  );

  let listCounter = 0;
  const currentFlatRef = useMemo(() => flattenBlocks(blocks), [blocks]);
  const currentBlock = currentFlatRef.find(b => b.id === focusedId);
  const currentType = currentBlock?.type || "paragraph";

  return (
    <div className={`editor-container ${isTyping ? "typing-mode" : ""}`}>
      
      {/* RENDER REMOTE CURSORS */}
      <RemoteCursorOverlay cursors={remoteCursors} />

      {blocks.map((block, index) => {
        if (block.type === "numbered-list") {
          listCounter++;
        } else {
          listCounter = 0;
        }

        const isMenuOpenForBlock = slashMenu.open && slashMenu.blockId === block.id;
        
        const isRangeSelection = 
          focusedId === block.id && 
          selection !== null && 
          !selection.isCollapsed && 
          selection.start.blockId === block.id;

        return (
          <BlockComponent
            key={block.id}
            block={block}
            index={index}
            listNumber={listCounter}
            isSelected={false}
            isFocused={focusedId === block.id}
            caretOffset={
              focusedId === block.id && selection?.start.blockId === block.id
                ? selection.start.offset
                : null
            }
            selectionEnd={
              focusedId === block.id && selection?.end.blockId === block.id
                ? selection.end.offset
                : null
            }
            previewType={focusedId === block.id ? previewType : null}
            isSlashMenuOpen={isMenuOpenForBlock}
            isRangeSelection={isRangeSelection}
            dropTarget={dropTarget}
            onUpdateContent={handleUpdateContent}
            onUpdateMetadata={handleUpdateMetadata}
            onSelectionChange={handleSelectionChange}
            onDeleteBlock={handleDeleteBlock}
            onAddParagraphBelow={handleAddParagraphBelow}
            onKeyDown={handleKeyDown}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}

            onOpenBlockMenu={handleOpenBlockMenu}
            onAddBlockAndOpenSlash={handleAddBlockAndOpenSlash}
          />
        );
      })}

      {slashMenu.open && (
        <SlashMenu
          position={{ x: slashMenu.x, y: slashMenu.y }}
          query={slashMenu.query}
          commands={filteredCommands}
          selectedIndex={slashMenu.selectedIndex}
          onSelect={(cmd) => applySlashCommand(cmd.type)}
          onClose={() => setSlashMenu((s) => ({ ...s, open: false }))}
        />
      )}

      {slashMenu.open && slashMenu.query === "" && (
         <div 
           className="slash-filter-placeholder"
           style={{
             top: slashMenu.top,
             left: slashMenu.x,
           }}
         >
           Filter...
         </div>
      )}

      {selection && !selection.isCollapsed && (
        <InlineToolbar
          onConvertBlock={handleInlineBlockConversion}
          onToggleMark={handleToggleMark}
          onUpdateBlockAlign={handleUpdateBlockAlign}
          currentType={currentType}
          onPreview={(type) => setPreviewType(type)}
        />
      )}

      {blockMenu.open && (
        <BlockActionMenu
           position={{ top: blockMenu.y, left: blockMenu.x }}
           onClose={() => setBlockMenu(prev => ({ ...prev, open: false }))}
           onDelete={() => {
               if (blockMenu.blockId) handleDeleteBlock(blockMenu.blockId);
           }}
           onDuplicate={handleDuplicateBlock}
           onTurnInto={(type) => {
               if (blockMenu.blockId) handleInlineBlockConversion(type, blockMenu.blockId);
           }}
        />
      )}
    </div>
  );
}