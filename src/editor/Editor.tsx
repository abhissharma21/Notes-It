import { useEffect, useRef, useState } from "react";
import Block from "./Block";
import SlashMenu from "./SlashMenu";
import { createBlock } from "./utils";
import { COMMANDS } from "./commands";
import type { Block as BlockType, Command } from "./types";

export default function Editor() {
  const [blocks, setBlocks] = useState<BlockType[]>([createBlock()]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [mouseActive, setMouseActive] = useState(false);

  useEffect(() => {
    let timeout: number;
    function onMouseMove() {
      setMouseActive(true);
      clearTimeout(timeout);
      timeout = window.setTimeout(() => setMouseActive(false), 800);
    }
    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      clearTimeout(timeout);
    };
  }, []);

  /* ---------- Slash Menu State ---------- */
  const [slashMenu, setSlashMenu] = useState<{
    open: boolean;
    blockIndex: number;
    query: string;
    selectedIndex: number;
    x: number;
    y: number;
  }>({
    open: false,
    blockIndex: -1,
    query: "",
    selectedIndex: 0,
    x: 0,
    y: 0,
  });

  const slashBlockRef = useRef<HTMLDivElement | null>(null);

  /* ---------- Input Handling ---------- */
  function updateBlock(index: number, text: string, el: HTMLDivElement) {
    setBlocks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], text };
      return next;
    });

    if (text.startsWith("/")) {
      const rect = el.getBoundingClientRect();
      slashBlockRef.current = el;

      // Filter logic here to reset index if list changes
      const newQuery = text.slice(1);

      setSlashMenu((s) => ({
        open: true,
        blockIndex: index,
        query: newQuery,
        selectedIndex: 0, // Always reset selection on type
        x: rect.left,
        y: rect.bottom + 4,
      }));
    } else {
      setSlashMenu((s) => ({ ...s, open: false }));
    }
  }

  function updateBlockMetadata(index: number, changes: Partial<BlockType>) {
    setBlocks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...changes };
      return next;
    });
  }

  /* ---------- Keyboard Handling ---------- */
  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    const block = blocks[index];

    // 1. Slash Menu Navigation
    if (slashMenu.open && index === slashMenu.blockIndex) {
      // Calculate filtered commands to know boundaries
      const filtered = COMMANDS.filter((c) =>
        c.label.toLowerCase().includes(slashMenu.query.toLowerCase())
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filtered.length > 0) {
          setSlashMenu((s) => ({
            ...s,
            selectedIndex: (s.selectedIndex + 1) % filtered.length,
          }));
        }
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filtered.length > 0) {
          setSlashMenu((s) => ({
            ...s,
            selectedIndex:
              (s.selectedIndex - 1 + filtered.length) % filtered.length,
          }));
        }
        return;
      }
      if (e.key === "Enter") {
        if (filtered.length > 0) {
          // Apply command
          e.preventDefault();
          applyCommand(filtered[slashMenu.selectedIndex].type);
        } else {
          // No results found?
          // "if i press enter keep that value there"
          // We simply close the menu. Default enter behavior (newline) will occur
          // unless we preventDefault. If we want to split the block, we allow default.
          setSlashMenu((s) => ({ ...s, open: false }));
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashMenu((s) => ({ ...s, open: false }));
        return;
      }
    }

    // 2. Multiline (Shift+Enter)
    if (e.key === "Enter" && e.shiftKey) {
      return;
    }

    // 3. New Block (Enter)
    if (e.key === "Enter") {
      e.preventDefault();
      insertBlockAfter(index);
      return;
    }

    // 4. Backspace
    if (e.key === "Backspace" && block.text === "") {
      if (block.type !== "paragraph") {
        e.preventDefault();
        setBlocks((prev) => {
          const next = [...prev];
          next[index] = {
            ...next[index],
            type: "paragraph",
            language: undefined,
          };
          return next;
        });
        return;
      }
      if (block.type === "paragraph") {
        e.preventDefault();
        removeBlock(index);
      }
    }
  }

  function insertBlockAfter(index: number) {
    const currentBlock = blocks[index];
    const nextType =
      currentBlock.type === "bullet-list"
        ? "bullet-list"
        : currentBlock.type === "numbered-list"
        ? "numbered-list"
        : "paragraph";

    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, createBlock({ type: nextType }));
      return next;
    });
    setFocusedIndex(index + 1);
  }

  function removeBlock(index: number) {
    if (blocks.length === 1 && index === 0) return;
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
    setFocusedIndex(Math.max(0, index - 1));
  }

  function applyCommand(type: BlockType["type"]) {
    if (slashBlockRef.current) {
      slashBlockRef.current.textContent = "";
    }
    setBlocks((prev) => {
      const next = [...prev];
      const meta = type === "code" ? { language: "TypeScript" } : {};
      next[slashMenu.blockIndex] = {
        ...next[slashMenu.blockIndex],
        type,
        text: "",
        ...meta,
      };
      return next;
    });
    setFocusedIndex(slashMenu.blockIndex);
    setSlashMenu((s) => ({ ...s, open: false }));
  }

  /* ---------- Drag Drop ---------- */
  function handleDragStart(index: number) {
    setDragIndex(index);
  }
  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
  }
  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      return;
    }
    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(null);
    setFocusedIndex(index);
  }

  const filteredCommands = COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(slashMenu.query.toLowerCase())
  );

  return (
    <div className="editor-container">
      {blocks.map((block, index) => (
        <Block
          key={block.id}
          block={block}
          index={index}
          isFocused={index === focusedIndex}
          mouseActive={mouseActive}
          onInput={updateBlock}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocusedIndex(index)}
          onMetaChange={updateBlockMetadata}
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={() => handleDrop(index)}
        />
      ))}

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
