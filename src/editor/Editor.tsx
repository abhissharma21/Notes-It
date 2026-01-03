import { useEffect, useMemo, useState } from "react";
import BlockComponent from "../components/Block";
import SlashMenu from "../components/SlashMenu";
import InlineToolbar from "./InlineToolbar";
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
} from "../utils";
import { COMMANDS } from "../commands";
import type {
  Block,
  BlockType,
  InlineNode,
  EditorSelection,
  MarkType,
} from "../types";
import { useHistory } from "../hooks/useHistory";

const getPlainText = (content: InlineNode[]) =>
  content.map((n) => n.text).join("");

export default function Editor() {
  // 1. Initialize blocks once to get a stable reference to the first ID
  const [initialBlocks] = useState(() => [createBlock("paragraph", "")]);

  const {
    state: blocks,
    set: setBlocksRaw,
    undo,
    redo,
    saveSnapshot,
  } = useHistory<Block[]>(initialBlocks);

  const setBlocks = (newBlocks: Block[], save: boolean) => {
    const normalized = normalizeEditorState(newBlocks);
    setBlocksRaw(normalized, save);
  };

  // 2. Set initial Focus and Selection to the first block
  const [focusedId, setFocusedId] = useState<string | null>(
    initialBlocks[0].id
  );

  const [selection, setSelection] = useState<EditorSelection | null>({
    start: { blockId: initialBlocks[0].id, offset: 0 },
    end: { blockId: initialBlocks[0].id, offset: 0 },
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
  }>({
    open: false,
    blockId: null,
    query: "",
    selectedIndex: 0,
    x: 0,
    y: 0,
  });

  const [isTyping, setIsTyping] = useState(false);

  const flatBlocks = useMemo(() => flattenBlocks(blocks), [blocks]);

  // --- Global Listeners ---
  useEffect(() => {
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

    window.addEventListener("mousemove", onMouseMove);
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
      if (!isTyping) setIsTyping(true);

      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [undo, redo, isTyping]);

  // --- Handlers ---

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
    const sel = window.getSelection();

    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      setSelection({
        start: { blockId: id, offset: range.startOffset },
        end: { blockId: id, offset: range.endOffset },
        isCollapsed: false,
      });
    } else {
      setSelection({
        start: { blockId: id, offset },
        end: { blockId: id, offset },
        isCollapsed: true,
      });
    }
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
        const newBlocks = updateBlockInTree(blocks, blockId, (b) => ({
          ...b,
          content: newContent,
        }));
        setBlocks(newBlocks, false);
      }
    }
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

    // Shortcuts
    if (e.metaKey || e.ctrlKey) {
      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        handleToggleMark("bold");
        return;
      }
      if (key === "i") {
        e.preventDefault();
        handleToggleMark("italic");
        return;
      }
      if (key === "u") {
        e.preventDefault();
        handleToggleMark("underline");
        return;
      }
      if (key === "e") {
        e.preventDefault();
        handleToggleMark("code");
        return;
      }
    }

    // Slash Menu
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

    if (dropTarget.pos === "top") {
      newTree = insertBeforeInTree(newTree, targetId, sourceBlock);
    } else {
      newTree = insertAfterInTree(newTree, targetId, sourceBlock);
    }

    setBlocks(newTree, false);
    setDragId(null);
    setDropTarget(null);
  };

  const filteredCommands = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(slashMenu.query.toLowerCase())
  );

  let listCounter = 0;
  const currentBlock = flatBlocks.find((b) => b.id === focusedId);
  const currentType = currentBlock?.type || "paragraph";

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
            isSlashMenuOpen={isMenuOpenForBlock}
            isRangeSelection={isRangeSelection}
            dropTarget={dropTarget}
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

      {selection && !selection.isCollapsed && (
        <InlineToolbar
          onConvertBlock={(type) => applySlashCommand(type)}
          onToggleMark={handleToggleMark}
          currentType={currentType}
          onPreview={() => {}}
        />
      )}
    </div>
  );
}
