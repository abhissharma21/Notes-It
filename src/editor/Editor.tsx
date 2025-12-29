import { useEffect, useRef, useState, useMemo } from "react";
import BlockComponent from "./Block";
import SlashMenu from "./SlashMenu";
import InlineToolbar from "./InlineToolbar";
import {
  createBlock,
  flattenBlocks,
  findNodePath,
  updateBlockInTree,
  insertAfterInTree,
  deleteBlockFromTree,
} from "./utils";
import { COMMANDS } from "./commands";
import type { Block, BlockType } from "./types";
import { useHistory } from "../hooks/useHistory";

export default function Editor() {
  const {
    state: blocks,
    set: setBlocks,
    undo,
    redo,
    saveSnapshot,
  } = useHistory<Block[]>([createBlock()]);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<BlockType | null>(null);
  const [mouseActive, setMouseActive] = useState(false);

  const lastSaveRef = useRef<number>(0);
  const slashBlockRef = useRef<HTMLDivElement | null>(null);

  // Linear view for keyboard navigation
  const flatBlocks = useMemo(() => flattenBlocks(blocks), [blocks]);

  useEffect(() => {
    let timeout: number;
    function onMouseMove() {
      setMouseActive(true);
      clearTimeout(timeout);
      timeout = window.setTimeout(() => setMouseActive(false), 800);
    }

    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(timeout);
    };
  }, [undo, redo]);

  /* ---------- Slash Menu ---------- */
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

  /* ---------- Block Operations ---------- */

  function updateBlock(
    id: string,
    html: string,
    text: string,
    el: HTMLDivElement
  ) {
    const now = Date.now();
    if (now - lastSaveRef.current > 1000) {
      saveSnapshot();
      lastSaveRef.current = now;
    }

    // Immutable Tree Update
    const newBlocks = updateBlockInTree(blocks, id, (b) => ({
      ...b,
      text: html,
    }));
    setBlocks(newBlocks, false);

    if (text.startsWith("/")) {
      const rect = el.getBoundingClientRect();
      slashBlockRef.current = el;
      setSlashMenu({
        open: true,
        blockId: id,
        query: text.slice(1),
        selectedIndex: 0,
        x: rect.left,
        y: rect.bottom + 4,
      });
    } else {
      setSlashMenu((s) => ({ ...s, open: false }));
    }
  }

  function updateBlockMetadata(id: string, changes: Partial<Block>) {
    saveSnapshot();
    const newBlocks = updateBlockInTree(blocks, id, (b) => ({
      ...b,
      ...changes,
    }));
    setBlocks(newBlocks, false);
  }

  function convertFocusedBlock(type: BlockType) {
    if (!focusedId) return;
    saveSnapshot();
    const newBlocks = updateBlockInTree(blocks, focusedId, (b) => ({
      ...b,
      type,
    }));
    setBlocks(newBlocks, false);
    setPreviewType(null);
  }

  /* ---------- Navigation & Structure ---------- */

  function handleKeyDown(e: React.KeyboardEvent, id: string) {
    const currentIndex = flatBlocks.findIndex((b) => b.id === id);
    const block = flatBlocks[currentIndex];

    // Slash Menu Nav
    if (slashMenu.open && id === slashMenu.blockId) {
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
          applyCommand(filtered[slashMenu.selectedIndex].type);
        else setSlashMenu((s) => ({ ...s, open: false }));
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashMenu((s) => ({ ...s, open: false }));
        return;
      }
    }

    // 1. Navigation
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (currentIndex > 0) setFocusedId(flatBlocks[currentIndex - 1].id);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (currentIndex < flatBlocks.length - 1)
        setFocusedId(flatBlocks[currentIndex + 1].id);
    }

    // 2. Indentation (Tab) - The Tree Power Move
    if (e.key === "Tab") {
      e.preventDefault();
      saveSnapshot();

      if (e.shiftKey) {
        // OUTDENT Logic (Complex: Move to grandparent's children after parent)
        // For simplicity in this demo: we only implement Indent.
        // Full Outdent requires robust path logic.
        return;
      } else {
        // INDENT Logic: Move into previous sibling
        const result = findNodePath(blocks, id);
        if (!result || result.index === 0) return; // No prev sibling

        const { blocks: siblings, index } = result;
        const prevSibling = siblings[index - 1];
        const currentBlock = siblings[index];

        // Remove from current list
        const withoutCurrent = [...siblings];
        withoutCurrent.splice(index, 1);

        // Add to prevSibling's children
        const newPrev = {
          ...prevSibling,
          children: [...prevSibling.children, currentBlock],
          isOpen: true,
        };

        // Reconstruct tree (simplified for depth=1, real app needs deep update)
        // Since we have immutable helpers, we can do this:

        // 1. Delete current
        let newTree = deleteBlockFromTree(blocks, id);
        // 2. Update prevSibling to have the child
        newTree = updateBlockInTree(newTree, prevSibling.id, (b) => ({
          ...b,
          children: [...b.children, currentBlock],
          isOpen: true,
        }));

        setBlocks(newTree, false);
      }
    }

    // 3. Enter (New Block)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveSnapshot();

      const content = block.text.replace(/<[^>]*>/g, "").trim();
      if (content === "" && block.type !== "paragraph") {
        // Convert to paragraph
        const newBlocks = updateBlockInTree(blocks, id, (b) => ({
          ...b,
          type: "paragraph",
          language: undefined,
        }));
        setBlocks(newBlocks, false);
        return;
      }

      // Insert Sibling
      const newBlock = createBlock();
      const newTree = insertAfterInTree(blocks, id, newBlock);
      setBlocks(newTree, false);
      setFocusedId(newBlock.id);
    }

    // 4. Backspace (Delete)
    if (e.key === "Backspace") {
      const content = block.text.replace(/<[^>]*>/g, "").trim();
      if (content === "") {
        if (block.type !== "paragraph") {
          e.preventDefault();
          saveSnapshot();
          const newBlocks = updateBlockInTree(blocks, id, (b) => ({
            ...b,
            type: "paragraph",
            language: undefined,
          }));
          setBlocks(newBlocks, false);
          return;
        }
        // Delete if paragraph
        if (blocks.length > 1 || block.children.length > 0) {
          // Don't delete last root
          e.preventDefault();
          saveSnapshot();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
          const prevId = flatBlocks[prevIndex].id;

          const newTree = deleteBlockFromTree(blocks, id);
          setBlocks(newTree, false);
          setFocusedId(prevId);
        }
      }
    }
  }

  function applyCommand(type: BlockType) {
    if (!slashMenu.blockId) return;
    saveSnapshot();
    if (slashBlockRef.current) slashBlockRef.current.textContent = "";

    const meta = type === "code" ? { language: "TypeScript" } : {};
    const newBlocks = updateBlockInTree(blocks, slashMenu.blockId, (b) => ({
      ...b,
      type,
      text: "",
      ...meta,
    }));

    setBlocks(newBlocks, false);
    setFocusedId(slashMenu.blockId);
    setSlashMenu((s) => ({ ...s, open: false }));
  }

  /* ---------- Drag & Drop ---------- */
  function handleDragStart(id: string) {
    setDragId(id);
  }
  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
  }
  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    saveSnapshot();

    // 1. Find the dragged node
    const sourceRes = findNodePath(blocks, dragId);
    if (!sourceRes) return;

    // 2. Delete it from old location
    let newTree = deleteBlockFromTree(blocks, dragId);

    // 3. Insert at new location
    newTree = insertAfterInTree(newTree, targetId, sourceRes.node);

    setBlocks(newTree, false);
    setDragId(null);
    setFocusedId(dragId); // Focus moved item
  }

  const filteredCommands = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(slashMenu.query.toLowerCase())
  );

  // Get current type for Toolbar
  const currentBlock = flatBlocks.find((b) => b.id === focusedId);
  const currentType =
    currentBlock && previewType
      ? previewType
      : currentBlock?.type || "paragraph";

  return (
    <div className="editor-container">
      {blocks.map((block, index) => {
        let listNum = 0;
        if (block.type === "numbered-list") {
          // Simplified root numbering
          // In a real tree, we'd need to count previous siblings
          listNum = index + 1;
        }

        return (
          <BlockComponent
            key={block.id}
            block={block}
            index={index}
            focusedId={focusedId}
            mouseActive={mouseActive}
            listNumber={listNum}
            previewType={focusedId === block.id ? previewType : null}
            onInput={updateBlock}
            onKeyDown={handleKeyDown}
            onFocus={setFocusedId}
            onMetaChange={updateBlockMetadata}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        );
      })}

      <InlineToolbar
        onConvertBlock={convertFocusedBlock}
        currentType={currentType}
        onPreview={setPreviewType}
      />

      {slashMenu.open && (
        <SlashMenu
          position={{ x: slashMenu.x, y: slashMenu.y }}
          query={slashMenu.query}
          commands={filteredCommands}
          selectedIndex={slashMenu.selectedIndex}
          onSelect={(cmd) => applyCommand(cmd.type)}
          onClose={() => setSlashMenu((s) => ({ ...s, open: false }))}
        />
      )}
    </div>
  );
}
