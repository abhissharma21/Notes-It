import { useEffect, useMemo, useState } from "react";
import BlockComponent from "../components/Block";
import SlashMenu from "../components/SlashMenu";
import {
  createBlock,
  flattenBlocks,
  findNodePath,
  updateBlockInTree,
  insertAfterInTree,
  deleteBlockFromTree,
  getTextLength,
  sanitizeBlock,
  normalizeEditorState,
} from "../utils";
import { COMMANDS } from "../commands";
import type { Block, BlockType, InlineNode, EditorSelection } from "../types";
import { useHistory } from "../hooks/useHistory";

const getPlainText = (content: InlineNode[]) =>
  content.map((n) => n.text).join("");

export default function Editor() {
  const {
    state: blocks,
    set: setBlocksRaw,
    undo,
    redo,
    saveSnapshot,
  } = useHistory<Block[]>([createBlock("paragraph", "")]);

  const setBlocks = (newBlocks: Block[], save: boolean) => {
    const normalized = normalizeEditorState(newBlocks);
    setBlocksRaw(normalized, save);
  };

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [selection, setSelection] = useState<EditorSelection | null>(null);
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
  }>({
    open: false,
    blockId: null,
    query: "",
    selectedIndex: 0,
    x: 0,
    y: 0,
  });

  // --- NEW: Typing Mode State ---
  const [isTyping, setIsTyping] = useState(false);

  const flatBlocks = useMemo(() => flattenBlocks(blocks), [blocks]);

  // Global Listeners
  useEffect(() => {
    // 1. Mouse Move -> Stop Typing Mode (Show handles again)
    function onMouseMove() {
      if (isTyping) setIsTyping(false);
    }

    function onWindowClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (slashMenu.open && !target.closest(".slash-menu")) {
        setSlashMenu((prev) => ({ ...prev, open: false }));
      }
    }
    function onDragEnd() {
      setDragId(null);
      setDropTarget(null);
    }

    window.addEventListener("mousemove", onMouseMove); // Listen for mouse movement
    window.addEventListener("mousedown", onWindowClick);
    document.addEventListener("dragend", onDragEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onWindowClick);
      document.removeEventListener("dragend", onDragEnd);
    };
  }, [slashMenu.open, isTyping]);

  useEffect(() => {
    function onWindowKeyDown(e: KeyboardEvent) {
      // 2. Key Down -> Enter Typing Mode (Hide handles)
      if (!isTyping) setIsTyping(true);

      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [undo, redo, isTyping]);

  // ... (Keep update handlers) ...
  const handleUpdateContent = (id: string, content: InlineNode[]) => {
    const newBlocks = updateBlockInTree(blocks, id, (b) => ({ ...b, content }));
    setBlocks(newBlocks, false);

    const plainText = getPlainText(content);
    if (plainText.startsWith("/")) {
      const el = document.getElementById(id);
      if (el) {
        const rect = el.getBoundingClientRect();
        setSlashMenu({
          open: true,
          blockId: id,
          query: plainText.slice(1),
          selectedIndex: 0,
          x: rect.left,
          y: rect.bottom + 5,
        });
      }
    } else {
      if (slashMenu.open) setSlashMenu((prev) => ({ ...prev, open: false }));
    }
  };

  const handleUpdateMetadata = (id: string, meta: Partial<Block>) => {
    saveSnapshot();
    const newBlocks = updateBlockInTree(blocks, id, (b) => ({ ...b, ...meta }));
    setBlocks(newBlocks, false);
  };

  const handleSelectionChange = (id: string, offset: number) => {
    setFocusedId(id);
    setSelection({
      start: { blockId: id, offset },
      end: { blockId: id, offset },
      isCollapsed: true,
    });
  };

  const handleDeleteBlock = (id: string) => {
    saveSnapshot();
    const index = flatBlocks.findIndex((b) => b.id === id);
    const prev = index > 0 ? flatBlocks[index - 1] : null;
    const next = index < flatBlocks.length - 1 ? flatBlocks[index + 1] : null;

    let newBlocks = deleteBlockFromTree(blocks, id);

    if (newBlocks.length === 0) {
      const newBlock = createBlock("paragraph");
      newBlocks = [newBlock];
      setBlocks(newBlocks, false);
      setFocusedId(newBlock.id);
      setSelection({
        start: { blockId: newBlock.id, offset: 0 },
        end: { blockId: newBlock.id, offset: 0 },
        isCollapsed: true,
      });
      return;
    }

    setBlocks(newBlocks, false);

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
    const currentIndex = flatBlocks.findIndex((b) => b.id === id);
    const block = flatBlocks[currentIndex];

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
      if (currentIndex > 0) setFocusedId(flatBlocks[currentIndex - 1].id);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (currentIndex < flatBlocks.length - 1)
        setFocusedId(flatBlocks[currentIndex + 1].id);
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveSnapshot();

      const contentLen = getTextLength(block.content);
      const isList =
        block.type === "bullet-list" || block.type === "numbered-list";

      if (isList && contentLen === 0) {
        const newBlocks = updateBlockInTree(blocks, id, (b) => ({
          ...b,
          type: "paragraph",
        }));
        setBlocks(newBlocks, false);
        return;
      }

      const nextType = isList ? block.type : "paragraph";
      const newBlock = createBlock(nextType);
      const newTree = insertAfterInTree(blocks, id, newBlock);
      setBlocks(newTree, false);
      setFocusedId(newBlock.id);
      setSelection({
        start: { blockId: newBlock.id, offset: 0 },
        end: { blockId: newBlock.id, offset: 0 },
        isCollapsed: true,
      });
    }

    if (e.key === "Backspace") {
      const length = getTextLength(block.content);
      if (length === 0 && blocks.length > 1) {
        e.preventDefault();
        saveSnapshot();
        const prevIndex = currentIndex - 1;

        if (prevIndex >= 0) {
          const prevBlock = flatBlocks[prevIndex];
          const prevLength = getTextLength(prevBlock.content);

          const newTree = deleteBlockFromTree(blocks, id);
          setBlocks(newTree, false);

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

    if (cmdType === "h1") {
      newType = "heading";
      newProps = { level: 1 };
    } else if (cmdType === "h2") {
      newType = "heading";
      newProps = { level: 2 };
    } else if (cmdType === "h3") {
      newType = "heading";
      newProps = { level: 3 };
    } else if (cmdType === "code") {
      newType = "code";
      newProps = { language: "TypeScript" };
    } else if (cmdType === "bullet-list") {
      newType = "bullet-list";
    } else if (cmdType === "numbered-list") {
      newType = "numbered-list";
    } else if (cmdType === "quote") {
      newType = "quote";
    } else if (cmdType === "divider") {
      newType = "divider";
    }

    const newBlocks = updateBlockInTree(blocks, slashMenu.blockId, (b) => {
      const updated = {
        ...b,
        type: newType,
        content: [],
        props: { ...b.props, ...newProps },
      };
      return sanitizeBlock(updated);
    });

    setBlocks(newBlocks, false);
    setSlashMenu((s) => ({ ...s, open: false }));

    setTimeout(() => {
      setFocusedId(slashMenu.blockId);
      setSelection({
        start: { blockId: slashMenu.blockId!, offset: 0 },
        end: { blockId: slashMenu.blockId!, offset: 0 },
        isCollapsed: true,
      });
    }, 0);
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
    const result = findNodePath(blocks, dragId);
    if (!result) return;
    const sourceBlock = result.node;
    let newTree = deleteBlockFromTree(blocks, dragId);
    newTree = insertAfterInTree(newTree, targetId, sourceBlock);
    setBlocks(newTree, false);
    setDragId(null);
    setDropTarget(null);
  };

  const filteredCommands = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(slashMenu.query.toLowerCase())
  );

  let listCounter = 0;

  // --- Add "typing-mode" class based on state ---
  return (
    <div className={`editor-container ${isTyping ? "typing-mode" : ""}`}>
      {blocks.map((block, index) => {
        if (block.type === "numbered-list") {
          listCounter++;
        } else {
          listCounter = 0;
        }

        const isMenuOpenForBlock =
          slashMenu.open && slashMenu.blockId === block.id;

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
            isSlashMenuOpen={isMenuOpenForBlock}
            onUpdateContent={handleUpdateContent}
            onUpdateMetadata={handleUpdateMetadata}
            onSelectionChange={handleSelectionChange}
            onDeleteBlock={handleDeleteBlock}
            onKeyDown={handleKeyDown}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
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
    </div>
  );
}
