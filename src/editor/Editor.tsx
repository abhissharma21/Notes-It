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

  // --- UI State ---
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<BlockType | null>(null);
  const [mouseActive, setMouseActive] = useState(false);

  // --- Multi-Selection State ---
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [selectionStartId, setSelectionStartId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [blockToolbarPos, setBlockToolbarPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // --- Slash Menu State ---
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

  const lastSaveRef = useRef<number>(0);
  const slashBlockRef = useRef<HTMLDivElement | null>(null);

  const flatBlocks = useMemo(() => flattenBlocks(blocks), [blocks]);

  // --- Toolbar Positioning for Blocks ---
  useEffect(() => {
    if (selectedIds.size > 0) {
      // Find the DOM elements to calculate position
      // We assume IDs match DOM IDs
      const ids = Array.from(selectedIds);
      let minTop = Infinity;
      let maxRight = -Infinity;
      let found = false;

      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top < minTop) minTop = rect.top;
          if (rect.right > maxRight) maxRight = rect.right;
          found = true;
        }
      });

      if (found) {
        // Position: Top-Right of the selection group, slightly offset
        setBlockToolbarPos({
          top: minTop + window.scrollY - 50,
          left: maxRight + window.scrollX - 100, // Shift left to keep on screen
        });
      }
    } else {
      setBlockToolbarPos(null);
    }
  }, [selectedIds, blocks]);

  // --- Global Event Listeners ---
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

      if (
        selectedIds.size > 0 &&
        (e.key === "Backspace" || e.key === "Delete")
      ) {
        e.preventDefault();
        deleteSelectedBlocks();
      }
    }

    function onMouseUp() {
      setIsMouseDown(false);
    }

    function onCopy(e: ClipboardEvent) {
      if (selectedIds.size > 0) {
        e.preventDefault();
        const selectedContent = flatBlocks
          .filter((b) => selectedIds.has(b.id))
          .map((b) => b.text.replace(/<[^>]*>/g, ""))
          .join("\n");
        e.clipboardData?.setData("text/plain", selectedContent);
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mouseup", onMouseUp);
    document.addEventListener("copy", onCopy);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("copy", onCopy);
      clearTimeout(timeout);
    };
  }, [undo, redo, selectedIds, flatBlocks]);

  /* ---------- Actions ---------- */
  function deleteSelectedBlocks() {
    saveSnapshot();
    let newBlocks = blocks;
    selectedIds.forEach((id) => {
      newBlocks = deleteBlockFromTree(newBlocks, id);
    });
    if (newBlocks.length === 0) newBlocks = [createBlock()];
    setBlocks(newBlocks, false);
    setSelectedIds(new Set());
  }

  function mergeSelectedBlocks() {
    saveSnapshot();
    // Get selected blocks in order
    const selected = flatBlocks.filter((b) => selectedIds.has(b.id));
    if (selected.length < 2) return;

    const first = selected[0];
    const combinedText = selected.map((b) => b.text).join("<br>"); // Join with breaks

    // Update first block
    let newBlocks = updateBlockInTree(blocks, first.id, (b) => ({
      ...b,
      text: combinedText,
    }));

    // Delete others
    for (let i = 1; i < selected.length; i++) {
      newBlocks = deleteBlockFromTree(newBlocks, selected[i].id);
    }

    setBlocks(newBlocks, false);
    setSelectedIds(new Set());
    setFocusedId(first.id); // Focus the merged block
  }

  function splitBlock() {
    const targetId =
      focusedId || (selectedIds.size === 1 ? Array.from(selectedIds)[0] : null);
    if (!targetId) return;

    const block = flatBlocks.find((b) => b.id === targetId);
    if (!block) return;

    // Split by <br> tags (simple implementation)
    // NOTE: This simple regex might need tuning for complex HTML, but works for basic <br> inserted by contentEditable
    const parts = block.text
      .split(/<br\s*\/?>/i)
      .filter((p) => p.trim() !== "");

    if (parts.length <= 1) return; // Nothing to split

    saveSnapshot();

    // Update current block with first part
    let newBlocks = updateBlockInTree(blocks, block.id, (b) => ({
      ...b,
      text: parts[0],
    }));

    // Insert remaining parts as new blocks
    let prevId = block.id;
    for (let i = 1; i < parts.length; i++) {
      const newBlock = createBlock({ text: parts[i], type: block.type });
      newBlocks = insertAfterInTree(newBlocks, prevId, newBlock);
      prevId = newBlock.id;
    }

    setBlocks(newBlocks, false);
    setSelectedIds(new Set());
  }

  // --- Block Selection Handlers ---
  function handleBlockMouseDown(id: string) {
    setIsMouseDown(true);
    setSelectionStartId(id);
    if (!selectedIds.has(id)) {
      setSelectedIds(new Set());
    }
  }

  function handleBlockMouseEnter(id: string) {
    if (isMouseDown && selectionStartId) {
      window.getSelection()?.removeAllRanges();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
        setFocusedId(null);
      }
      const startIndex = flatBlocks.findIndex((b) => b.id === selectionStartId);
      const currentIndex = flatBlocks.findIndex((b) => b.id === id);
      if (startIndex === -1 || currentIndex === -1) return;
      const start = Math.min(startIndex, currentIndex);
      const end = Math.max(startIndex, currentIndex);
      const newSelection = new Set<string>();
      for (let i = start; i <= end; i++) {
        newSelection.add(flatBlocks[i].id);
      }
      setSelectedIds(newSelection);
    }
  }

  // --- General Updates ---
  function updateBlock(
    id: string,
    html: string,
    text: string,
    el: HTMLDivElement
  ) {
    if (selectedIds.size > 0) setSelectedIds(new Set());
    const now = Date.now();
    if (now - lastSaveRef.current > 1000) {
      saveSnapshot();
      lastSaveRef.current = now;
    }
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

  function handleKeyDown(e: React.KeyboardEvent, id: string) {
    if (selectedIds.size > 0) setSelectedIds(new Set());
    const currentIndex = flatBlocks.findIndex((b) => b.id === id);
    const block = flatBlocks[currentIndex];

    // Slash Menu
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

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (currentIndex > 0) setFocusedId(flatBlocks[currentIndex - 1].id);
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (currentIndex < flatBlocks.length - 1)
        setFocusedId(flatBlocks[currentIndex + 1].id);
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) return;
      const result = findNodePath(blocks, id);
      if (!result || result.index === 0) return;
      saveSnapshot();
      const { blocks: siblings, index } = result;
      const prevSibling = siblings[index - 1];
      const currentBlock = siblings[index];
      let newTree = deleteBlockFromTree(blocks, id);
      newTree = updateBlockInTree(newTree, prevSibling.id, (b) => ({
        ...b,
        children: [...b.children, currentBlock],
        isOpen: true,
      }));
      setBlocks(newTree, false);
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveSnapshot();
      const content = block.text.replace(/<[^>]*>/g, "").trim();
      if (content === "" && block.type !== "paragraph") {
        const newBlocks = updateBlockInTree(blocks, id, (b) => ({
          ...b,
          type: "paragraph",
          language: undefined,
        }));
        setBlocks(newBlocks, false);
        return;
      }
      const newBlock = createBlock();
      const newTree = insertAfterInTree(blocks, id, newBlock);
      setBlocks(newTree, false);
      setFocusedId(newBlock.id);
    }
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
        if (blocks.length > 1 || block.children.length > 0) {
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

  function handleDragStart(id: string) {
    setDragId(id);
  }
  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
  }
  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    saveSnapshot();
    const sourceRes = findNodePath(blocks, dragId);
    if (!sourceRes) return;
    let newTree = deleteBlockFromTree(blocks, dragId);
    newTree = insertAfterInTree(newTree, targetId, sourceRes.node);
    setBlocks(newTree, false);
    setDragId(null);
    setFocusedId(dragId);
  }

  const filteredCommands = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(slashMenu.query.toLowerCase())
  );
  const currentBlock = flatBlocks.find((b) => b.id === focusedId);
  const currentType =
    currentBlock && previewType
      ? previewType
      : currentBlock?.type || "paragraph";

  // Check split availability (single block selected or focused, containing <br>)
  const targetSplitBlock = focusedId
    ? flatBlocks.find((b) => b.id === focusedId)
    : selectedIds.size === 1
    ? flatBlocks.find((b) => b.id === Array.from(selectedIds)[0])
    : null;

  const canSplit = targetSplitBlock
    ? targetSplitBlock.text.includes("<br")
    : false;

  return (
    <div className="editor-container">
      {blocks.map((block, index) => {
        const listNum = block.type === "numbered-list" ? index + 1 : 0;
        return (
          <BlockComponent
            key={block.id}
            block={block}
            index={index}
            focusedId={focusedId}
            selectedIds={selectedIds}
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
            onMouseDown={handleBlockMouseDown}
            onMouseEnter={handleBlockMouseEnter}
          />
        );
      })}

      {/* 
          TOOLBAR LOGIC:
          1. If Multiple Blocks Selected -> Show Block Toolbar (Merge)
          2. If Single Block Focused/Selected AND has line breaks -> Show Block Toolbar (Split) inside Text mode?
          
          We simply pass props to InlineToolbar to handle both via 'mode'.
      */}

      {selectedIds.size > 0 ? (
        <InlineToolbar
          onConvertBlock={() => {}} // No conversion in block mode yet
          currentType="paragraph" // Dummy
          onPreview={() => {}}
          mode="block"
          staticPosition={blockToolbarPos}
          onMerge={selectedIds.size > 1 ? mergeSelectedBlocks : undefined}
          onSplit={canSplit ? splitBlock : undefined}
          canSplit={canSplit}
        />
      ) : (
        <InlineToolbar
          onConvertBlock={convertFocusedBlock}
          currentType={currentType}
          onPreview={setPreviewType}
          mode="text"
          canSplit={canSplit} // Allow splitting from text menu too if needed
          onSplit={splitBlock}
        />
      )}

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
