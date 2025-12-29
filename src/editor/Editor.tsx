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
  insertBeforeInTree, // NEW IMPORT
  deleteBlockFromTree,
} from "./utils";
import { COMMANDS } from "./commands";
import type { Block, BlockType } from "./types";
import { useHistory } from "../hooks/useHistory";

// Helper to get top-level selected blocks to avoid duplicating children
function getTopLevelSelectedBlocks(
  blocks: Block[],
  selectedIds: Set<string>
): Block[] {
  const result: Block[] = [];
  for (const block of blocks) {
    if (selectedIds.has(block.id)) {
      result.push(block);
    } else {
      if (block.children.length > 0) {
        result.push(...getTopLevelSelectedBlocks(block.children, selectedIds));
      }
    }
  }
  return result;
}

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
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    pos: "top" | "bottom";
  } | null>(null);

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

  // --- Split Info State ---
  const [splitInfo, setSplitInfo] = useState<{
    lineCount: number;
    hasSelection: boolean;
    isAllSelected: boolean;
    hasMultiLineSelection: boolean;
  }>({
    lineCount: 0,
    hasSelection: false,
    isAllSelected: false,
    hasMultiLineSelection: false,
  });

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

  // --- Global Event Listeners ---
  useEffect(() => {
    function onWindowMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (
        target.closest(".block-wrapper") ||
        target.closest(".inline-toolbar") ||
        target.closest(".slash-menu")
      ) {
        return;
      }
      if (selectedIds.size > 0) setSelectedIds(new Set());
      if (focusedId) setFocusedId(null);
    }

    function onMouseUp() {
      setIsMouseDown(false);
    }

    function onDragEnd() {
      setIsMouseDown(false);
      setSelectionStartId(null);
      setDragId(null);
      setDropTarget(null); // Clear drop indicator
    }

    function onMouseMove() {
      setMouseActive(true);
    }

    window.addEventListener("mousedown", onWindowMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("dragend", onDragEnd);

    return () => {
      window.removeEventListener("mousedown", onWindowMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("dragend", onDragEnd);
    };
  }, [selectedIds, focusedId]);

  // --- Split Info ---
  useEffect(() => {
    const updateSplitInfo = () => {
      const sel = window.getSelection();
      const hasSelection =
        !!sel && !sel.isCollapsed && sel.toString().length > 0;

      let lineCount = 0;
      let isAllSelected = false;
      let hasMultiLineSelection = false;

      if (focusedId) {
        const block = flatBlocks.find((b) => b.id === focusedId);
        if (block) {
          const el = document.getElementById(focusedId);
          const blockEl = el?.querySelector(".block");
          if (blockEl) {
            const html = blockEl.innerHTML;
            const matches = html.match(/<br/g);
            lineCount = matches ? matches.length + 1 : 1;
            if (hasSelection && sel && sel.rangeCount > 0) {
              const textLen = (blockEl as HTMLElement).innerText.length;
              const selLen = sel.toString().length;
              if (selLen >= textLen - 1 && textLen > 0) {
                isAllSelected = true;
              }
              const range = sel.getRangeAt(0);
              const fragment = range.cloneContents();
              const div = document.createElement("div");
              div.appendChild(fragment);
              if (div.querySelector("br")) hasMultiLineSelection = true;
            }
          }
        }
      }
      setSplitInfo({
        lineCount,
        hasSelection,
        isAllSelected,
        hasMultiLineSelection,
      });
    };

    document.addEventListener("selectionchange", updateSplitInfo);
    document.addEventListener("keyup", updateSplitInfo);
    document.addEventListener("mouseup", updateSplitInfo);
    updateSplitInfo();
    return () => {
      document.removeEventListener("selectionchange", updateSplitInfo);
      document.removeEventListener("keyup", updateSplitInfo);
      document.removeEventListener("mouseup", updateSplitInfo);
    };
  }, [focusedId, flatBlocks]);

  // --- Toolbar Positioning ---
  useEffect(() => {
    if (selectedIds.size > 0) {
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
        setBlockToolbarPos({
          top: minTop + window.scrollY - 50,
          left: maxRight + window.scrollX - 100,
        });
      }
    } else {
      setBlockToolbarPos(null);
    }
  }, [selectedIds, blocks]);

  // --- Keyboard & Copy ---
  useEffect(() => {
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
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("copy", onCopy);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("copy", onCopy);
    };
  }, [undo, redo, selectedIds, flatBlocks]);

  /* ---------- Block Actions ---------- */
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
    const selected = flatBlocks.filter((b) => selectedIds.has(b.id));
    if (selected.length < 2) return;
    const first = selected[0];
    const combinedText = selected.map((b) => b.text).join("<br>");
    let newBlocks = updateBlockInTree(blocks, first.id, (b) => ({
      ...b,
      text: combinedText,
    }));
    for (let i = 1; i < selected.length; i++) {
      newBlocks = deleteBlockFromTree(newBlocks, selected[i].id);
    }
    setBlocks(newBlocks, false);
    setSelectedIds(new Set());
    setFocusedId(first.id);
  }

  function splitBlock(mode: "all" | "selection") {
    if (!focusedId) return;
    const block = flatBlocks.find((b) => b.id === focusedId);
    if (!block) return;
    saveSnapshot();
    let parts: string[] = [];

    if (mode === "selection") {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const fragment = range.extractContents();
        const div = document.createElement("div");
        div.appendChild(fragment);
        const extractedHtml = div.innerHTML;
        const blockEl = document.querySelector(`[id='${focusedId}'] .block`);
        if (blockEl) {
          const remainingHtml = blockEl.innerHTML;
          let newBlocks = updateBlockInTree(blocks, focusedId, (b) => ({
            ...b,
            text: remainingHtml,
          }));
          const newBlock = createBlock({
            text: extractedHtml,
            type: block.type,
          });
          newBlocks = insertAfterInTree(newBlocks, focusedId, newBlock);
          setBlocks(newBlocks, false);
        }
        return;
      }
    }

    if (mode === "all") {
      parts = block.text.split(/<br\s*\/?>/i).filter((p) => p.trim() !== "");
    }

    if (parts.length <= 1) return;
    let newBlocks = updateBlockInTree(blocks, block.id, (b) => ({
      ...b,
      text: parts[0],
    }));
    let prevId = block.id;
    for (let i = 1; i < parts.length; i++) {
      const newBlock = createBlock({ text: parts[i], type: block.type });
      newBlocks = insertAfterInTree(newBlocks, prevId, newBlock);
      prevId = newBlock.id;
    }
    setBlocks(newBlocks, false);
  }

  /* ---------- Handlers ---------- */
  function handleBlockMouseDown(id: string) {
    setIsMouseDown(true);
    setSelectionStartId(id);
    if (!selectedIds.has(id)) {
      setSelectedIds(new Set());
    }
  }

  function handleBlockFocus(id: string) {
    setFocusedId(id);
    if (selectedIds.size > 0) setSelectedIds(new Set());
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
    if (!selectedIds.has(id)) {
      setSelectedIds(new Set());
    }
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();

    // Calculate drop position (Top vs Bottom)
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pos = y < rect.height / 2 ? "top" : "bottom";

    setDropTarget({ id, pos });
  }

  function handleDrop(targetId: string) {
    setIsMouseDown(false);
    setSelectionStartId(null);
    setDropTarget(null); // Clear indicator immediately

    if (!dragId) return;

    // Use current dropTarget state if available for position, else default to bottom
    // We captured it in handleDragOver
    const targetPos = dropTarget?.id === targetId ? dropTarget.pos : "bottom";

    saveSnapshot();

    // 1. Prepare list of blocks to move
    let blocksToMove: Block[] = [];
    if (selectedIds.has(dragId) && selectedIds.size > 0) {
      if (selectedIds.has(targetId)) {
        setDragId(null);
        return;
      }
      blocksToMove = getTopLevelSelectedBlocks(blocks, selectedIds);
    } else {
      if (dragId === targetId) {
        setDragId(null);
        return;
      }
      const sourceRes = findNodePath(blocks, dragId);
      if (sourceRes) blocksToMove = [sourceRes.node];
    }

    if (blocksToMove.length === 0) {
      setDragId(null);
      return;
    }

    // 2. Remove from tree
    let newTree = blocks;
    blocksToMove.forEach((b) => {
      newTree = deleteBlockFromTree(newTree, b.id);
    });

    // 3. Insert at target
    // We reverse if inserting 'top' so they stack correctly (optional depending on UX preference)
    // But usually iterating forward is fine.
    // If 'top', we insertBefore. If we have multiple, we insert them one by one.
    // To keep order:
    //   Insert Block A before Target -> [A, Target]
    //   Insert Block B before Target -> [A, B, Target]? No, InsertBefore inserts strictly before anchor.
    //   Actually, if we iterate [A, B] and insert A before Target, then B before Target, we get [A, B, Target].
    //   Wait:
    //   Start: [Target]
    //   Insert A before Target: [A, Target]
    //   Insert B before Target: [A, B, Target] -> Yes.

    // If 'bottom', we insertAfter.
    //   Start: [Target]
    //   Insert A after Target: [Target, A]
    //   Insert B after Target: [Target, B, A] -> NO.
    //   To keep [A, B] order when inserting after:
    //   Insert A after Target -> Anchor becomes A.
    //   Insert B after A.

    let anchorId = targetId;

    if (targetPos === "top") {
      // Insert BEFORE logic
      // We iterate normally. Each insert puts it before the CURRENT anchor (targetId).
      // But wait, if we insert A before T => A, T.
      // Next insert B before T => A, B, T.
      // Order preserved.
      blocksToMove.forEach((b) => {
        newTree = insertBeforeInTree(newTree, targetId, b);
      });
    } else {
      // Insert AFTER logic
      // We need to update anchorId so they chain.
      blocksToMove.forEach((b) => {
        newTree = insertAfterInTree(newTree, anchorId, b);
        anchorId = b.id;
      });
    }

    setBlocks(newTree, false);
    setDragId(null);
    setSelectedIds(new Set());
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
            dropTarget={dropTarget}
            onInput={updateBlock}
            onKeyDown={handleKeyDown}
            onFocus={handleBlockFocus}
            onMetaChange={updateBlockMetadata}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onMouseDown={handleBlockMouseDown}
            onMouseEnter={handleBlockMouseEnter}
          />
        );
      })}

      {selectedIds.size > 0 ? (
        <InlineToolbar
          onConvertBlock={() => {}}
          currentType="paragraph"
          onPreview={() => {}}
          mode="block"
          staticPosition={blockToolbarPos}
          onMerge={selectedIds.size > 1 ? mergeSelectedBlocks : undefined}
          onSplit={splitBlock}
          canSplit={false}
        />
      ) : (
        <InlineToolbar
          onConvertBlock={convertFocusedBlock}
          currentType={currentType}
          onPreview={setPreviewType}
          mode="text"
          splitInfo={splitInfo}
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
