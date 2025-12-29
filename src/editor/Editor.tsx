// src/editor/Editor.tsx

import { useEffect, useRef, useState } from "react";
import Block from "./Block";
import { createBlock } from "./utils";
import { COMMANDS } from "./commands";
import type { Block as BlockType } from "./types";

export default function Editor() {
  const [blocks, setBlocks] = useState<BlockType[]>([createBlock()]);

  const [focusedIndex, setFocusedIndex] = useState(0);

  /* ---------- Mouse Activity (ONLY signal) ---------- */

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

  /* ---------- Slash Menu ---------- */

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

  /* ---------- Block Input ---------- */

  function updateBlock(index: number, text: string, el: HTMLDivElement) {
    setBlocks((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], text };
      return next;
    });

    if (text.startsWith("/")) {
      const rect = el.getBoundingClientRect();
      slashBlockRef.current = el;

      setSlashMenu({
        open: true,
        blockIndex: index,
        query: text.slice(1),
        selectedIndex: 0,
        x: rect.left,
        y: rect.bottom + 4,
      });
    } else {
      setSlashMenu((s) => ({ ...s, open: false }));
    }
  }

  /* ---------- Keyboard ---------- */

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    const text = blocks[index].text;

    if (slashMenu.open && index === slashMenu.blockIndex) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashMenu((s) => ({
          ...s,
          selectedIndex: (s.selectedIndex + 1) % filteredCommands.length,
        }));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashMenu((s) => ({
          ...s,
          selectedIndex:
            (s.selectedIndex - 1 + filteredCommands.length) %
            filteredCommands.length,
        }));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        applyCommand(filteredCommands[slashMenu.selectedIndex].type);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setSlashMenu((s) => ({ ...s, open: false }));
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      insertBlockAfter(index);
      return;
    }

    if (e.key === "Backspace" && text.length === 0) {
      e.preventDefault();
      removeBlock(index);
    }
  }

  /* ---------- Block Ops ---------- */

  function insertBlockAfter(index: number) {
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, createBlock());
      return next;
    });
    setFocusedIndex(index + 1);
  }

  function removeBlock(index: number) {
    if (blocks.length === 1 || index === 0) return;

    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });

    setFocusedIndex(index - 1);
  }

  function applyCommand(type: BlockType["type"]) {
    if (slashBlockRef.current) {
      slashBlockRef.current.textContent = "";
    }

    setBlocks((prev) => {
      const next = [...prev];
      next[slashMenu.blockIndex] = {
        ...next[slashMenu.blockIndex],
        type,
        text: "",
      };
      return next;
    });

    setFocusedIndex(slashMenu.blockIndex);
    setSlashMenu((s) => ({ ...s, open: false }));
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
          onFocus={setFocusedIndex}
          onDragStart={() => {}}
          onDragOver={() => {}}
          onDrop={() => {}}
        />
      ))}

      {slashMenu.open && (
        <div
          className="slash-menu"
          style={{ top: slashMenu.y, left: slashMenu.x }}
        >
          {filteredCommands.map((cmd, i) => (
            <div
              key={cmd.type}
              className={`slash-item ${
                i === slashMenu.selectedIndex ? "active" : ""
              }`}
            >
              {cmd.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
