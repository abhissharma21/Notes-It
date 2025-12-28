import { useEffect, useRef, useState, useMemo } from "react";
import BlockComponent from "./Block";
import { COMMANDS } from "./commands";
import type { Block, BlockType, EditorState } from "./types";

export default function Editor() {
  const [state, setState] = useState<EditorState>({
    blocks: [{ id: crypto.randomUUID(), type: "paragraph", text: "" }],
  });
  const [focusIndex, setFocusIndex] = useState(0);
  const [slashMenu, setSlashMenu] = useState({
    open: false,
    query: "",
    selectedIndex: 0,
    x: 0,
    y: 0,
  });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const filteredCommands = useMemo(
    () =>
      COMMANDS.filter((c) =>
        c.label.toLowerCase().includes(slashMenu.query.toLowerCase())
      ),
    [slashMenu.query]
  );

  const applyCommand = (type: BlockType, index: number = focusIndex) => {
    setState((prev) => {
      const newBlocks = [...prev.blocks];
      newBlocks[index] = { ...newBlocks[index], type, text: "" };

      if (type === "divider") {
        newBlocks.splice(index + 1, 0, {
          id: crypto.randomUUID(),
          type: "paragraph",
          text: "",
        });
        setTimeout(() => setFocusIndex(index + 1), 0);
      } else {
        setFocusIndex(index);
      }
      return { blocks: newBlocks };
    });
    setSlashMenu((s) => ({ ...s, open: false, query: "", selectedIndex: 0 }));
  };

  const handleEnter = (index: number) => {
    const current = state.blocks[index];
    const newBlocks = [...state.blocks];

    if (
      (current.type === "bullet-list" || current.type === "numbered-list") &&
      current.text === ""
    ) {
      newBlocks[index].type = "paragraph";
      setState({ blocks: newBlocks });
      return;
    }

    const nextType: BlockType =
      current.type === "bullet-list" || current.type === "numbered-list"
        ? current.type
        : "paragraph";
    newBlocks.splice(index + 1, 0, {
      id: crypto.randomUUID(),
      type: nextType,
      text: "",
    });
    setState({ blocks: newBlocks });
    setFocusIndex(index + 1);
  };

  const handleBackspace = (index: number) => {
    const current = state.blocks[index];
    const newBlocks = [...state.blocks];

    // FIX: Handling Divider deletion
    if (current.type === "divider") {
      if (newBlocks.length === 1) {
        newBlocks[0] = { ...newBlocks[0], type: "paragraph", text: "" };
      } else {
        newBlocks.splice(index, 1);
      }
      setState({ blocks: newBlocks });
      setFocusIndex(index > 0 ? index - 1 : 0);
      return;
    }

    if (current.type !== "paragraph") {
      applyCommand("paragraph", index);
      return;
    }

    if (index === 0) return;
    const prev = newBlocks[index - 1];
    newBlocks[index - 1] = { ...prev, text: prev.text + current.text };
    newBlocks.splice(index, 1);
    setState({ blocks: newBlocks });
    setFocusIndex(index - 1);
  };

  useEffect(() => {
    if (!slashMenu.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashMenu((s) => ({
          ...s,
          selectedIndex: (s.selectedIndex + 1) % filteredCommands.length,
        }));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashMenu((s) => ({
          ...s,
          selectedIndex:
            (s.selectedIndex - 1 + filteredCommands.length) %
            filteredCommands.length,
        }));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (filteredCommands[slashMenu.selectedIndex])
          applyCommand(filteredCommands[slashMenu.selectedIndex].type);
      } else if (e.key === "Escape")
        setSlashMenu((s) => ({ ...s, open: false }));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [slashMenu.open, filteredCommands, slashMenu.selectedIndex]);

  return (
    <div className="editor-container">
      {state.blocks.map((block, index) => (
        <BlockComponent
          key={block.id}
          block={block}
          focused={index === focusIndex}
          isMenuOpen={slashMenu.open && index === focusIndex}
          onChange={(text) => {
            if (block.type === "paragraph") {
              if (text === "# ") return applyCommand("h1", index);
              if (text === "## ") return applyCommand("h2", index);
              if (text === "### ") return applyCommand("h3", index);
              if (text === "* " || text === "- ")
                return applyCommand("bullet-list", index);
              if (text === "1. ") return applyCommand("numbered-list", index);
              if (text === "> ") return applyCommand("quote", index);
              if (text === "---") return applyCommand("divider", index);
            }
            const newBlocks = [...state.blocks];
            newBlocks[index].text = text;
            setState({ blocks: newBlocks });

            if (text === "/") {
              const el = document.activeElement as HTMLElement;
              const rect = el.getBoundingClientRect();
              setSlashMenu({
                open: true,
                query: "",
                selectedIndex: 0,
                x: rect.left,
                y: rect.bottom + window.scrollY,
              });
            } else if (text.startsWith("/")) {
              setSlashMenu((s) => ({ ...s, query: text.slice(1) }));
            } else if (slashMenu.open) {
              setSlashMenu((s) => ({ ...s, open: false }));
            }
          }}
          onEnter={() => handleEnter(index)}
          onBackspaceAtStart={() => handleBackspace(index)}
          onArrowUpAtStart={() => index > 0 && setFocusIndex(index - 1)}
          onArrowDownAtEnd={() =>
            index < state.blocks.length - 1 && setFocusIndex(index + 1)
          }
          onSlashDetected={() => {}}
        />
      ))}

      {slashMenu.open && (
        <div
          className="slash-menu"
          style={{ top: slashMenu.y, left: slashMenu.x }}
        >
          <div ref={scrollContainerRef} className="slash-scroll">
            {filteredCommands.map((cmd, i) => {
              const showCat =
                i === 0 || cmd.category !== filteredCommands[i - 1].category;
              return (
                <div key={cmd.type}>
                  {showCat && (
                    <div className="slash-category">{cmd.category}</div>
                  )}
                  <div
                    className={`slash-item ${
                      i === slashMenu.selectedIndex ? "active" : ""
                    }`}
                    onClick={() => applyCommand(cmd.type)}
                    onMouseEnter={() =>
                      setSlashMenu((s) => ({ ...s, selectedIndex: i }))
                    }
                  >
                    <div className="slash-item-label">{cmd.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
