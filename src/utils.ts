import {
  type Block,
  type InlineNode,
  type Mark,
  type MarkType,
  type BlockType,
} from "./types";

// --- 1. SCHEMA DEFINITION ---
interface BlockRule {
  isVoid?: boolean;
  allowMarks?: boolean;
}

const BLOCK_SCHEMA: Record<BlockType, BlockRule> = {
  paragraph: { allowMarks: true },
  heading: { allowMarks: true },
  "bullet-list": { allowMarks: true },
  "numbered-list": { allowMarks: true },
  quote: { allowMarks: true },
  code: { allowMarks: false }, // Code = No Marks
  divider: { isVoid: true },
};

// --- 2. SANITIZATION ---
export function sanitizeBlock(block: Block): Block {
  const rule = BLOCK_SCHEMA[block.type];
  if (!rule) return { ...block, type: "paragraph" };

  if (rule.isVoid && block.content.length > 0) {
    return { ...block, content: [] };
  }

  if (rule.allowMarks === false) {
    const hasMarks = block.content.some((n) => n.marks.length > 0);
    if (hasMarks) {
      return {
        ...block,
        content: block.content.map((n) => ({ ...n, marks: [] })),
      };
    }
  }
  return block;
}

// --- 3. FACTORY & NORMALIZATION ---
const uid = () => Math.random().toString(36).slice(2, 9);

export function createBlock(type: BlockType = "paragraph", text = ""): Block {
  return sanitizeBlock({
    id: crypto.randomUUID(),
    type,
    content: text ? [{ id: uid(), text, marks: [] }] : [],
    children: [],
    isOpen: true,
    props: {},
  });
}

export function normalizeEditorState(blocks: Block[]): Block[] {
  if (blocks.length === 0) return [createBlock("paragraph")];
  return blocks.map(sanitizeBlock);
}

// --- 4. TREE UTILS ---
export function flattenBlocks(blocks: Block[]): Block[] {
  return blocks.reduce((acc: Block[], block) => {
    acc.push(block);
    if (block.children.length > 0 && block.isOpen) {
      acc.push(...flattenBlocks(block.children));
    }
    return acc;
  }, []);
}

export function findNodePath(
  blocks: Block[],
  id: string,
  path: { blocks: Block[]; index: number }[] = []
): { blocks: Block[]; index: number; node: Block } | null {
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].id === id) return { blocks, index: i, node: blocks[i] };
    const found = findNodePath(blocks[i].children, id, [
      ...path,
      { blocks, index: i },
    ]);
    if (found) return found;
  }
  return null;
}

export function updateBlockInTree(
  blocks: Block[],
  id: string,
  update: (block: Block) => Block
): Block[] {
  return blocks.map((block) => {
    if (block.id === id) return sanitizeBlock(update(block));
    if (block.children.length > 0) {
      return {
        ...block,
        children: updateBlockInTree(block.children, id, update),
      };
    }
    return block;
  });
}

export function deleteBlockFromTree(blocks: Block[], id: string): Block[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) => ({ ...b, children: deleteBlockFromTree(b.children, id) }));
}

export function insertAfterInTree(
  blocks: Block[],
  anchorId: string,
  newBlock: Block
): Block[] {
  const newBlocks: Block[] = [];
  for (const block of blocks) {
    newBlocks.push(block);
    if (block.id === anchorId) {
      newBlocks.push(newBlock);
    } else if (block.children.length > 0) {
      newBlocks[newBlocks.length - 1] = {
        ...block,
        children: insertAfterInTree(block.children, anchorId, newBlock),
      };
    }
  }
  return newBlocks;
}

export function insertBeforeInTree(
  blocks: Block[],
  anchorId: string,
  newBlock: Block
): Block[] {
  const newBlocks: Block[] = [];
  for (const block of blocks) {
    if (block.id === anchorId) {
      newBlocks.push(newBlock);
      newBlocks.push(block);
    } else {
      newBlocks.push(block);
      if (block.children.length > 0) {
        newBlocks[newBlocks.length - 1] = {
          ...block,
          children: insertBeforeInTree(block.children, anchorId, newBlock),
        };
      }
    }
  }
  return newBlocks;
}

// --- 5. FORMATTING LOGIC ---

function areMarksEqual(a: Mark[], b: Mark[]) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x.type.localeCompare(y.type));
  const sortedB = [...b].sort((x, y) => x.type.localeCompare(y.type));
  return JSON.stringify(sortedA) === JSON.stringify(sortedB);
}

export function toggleMarkInRange(
  content: InlineNode[],
  start: number,
  end: number,
  markType: MarkType
): InlineNode[] {
  if (start >= end) return content;

  let allHaveMark = true;
  let currentPos = 0;

  // Check if we should ADD or REMOVE
  for (const node of content) {
    const nodeEnd = currentPos + node.text.length;
    if (Math.max(currentPos, start) < Math.min(nodeEnd, end)) {
      if (!node.marks.some((m) => m.type === markType)) {
        allHaveMark = false;
        break;
      }
    }
    currentPos = nodeEnd;
  }

  const shouldAdd = !allHaveMark;
  currentPos = 0;
  const newContent: InlineNode[] = [];

  for (const node of content) {
    const nodeStart = currentPos;
    const nodeEnd = currentPos + node.text.length;

    if (nodeEnd <= start || nodeStart >= end) {
      newContent.push(node);
    } else {
      const relativeStart = Math.max(0, start - nodeStart);
      const relativeEnd = Math.min(node.text.length, end - nodeStart);

      if (relativeStart > 0) {
        newContent.push({
          id: uid(),
          text: node.text.slice(0, relativeStart),
          marks: node.marks,
        });
      }

      const middleText = node.text.slice(relativeStart, relativeEnd);
      let newMarks = [...node.marks];
      if (shouldAdd) {
        if (!newMarks.some((m) => m.type === markType))
          newMarks.push({ type: markType });
      } else {
        newMarks = newMarks.filter((m) => m.type !== markType);
      }

      newContent.push({ id: uid(), text: middleText, marks: newMarks });

      if (relativeEnd < node.text.length) {
        newContent.push({
          id: uid(),
          text: node.text.slice(relativeEnd),
          marks: node.marks,
        });
      }
    }
    currentPos = nodeEnd;
  }

  return mergeSimilarNodes(newContent);
}

function mergeSimilarNodes(content: InlineNode[]): InlineNode[] {
  const merged: InlineNode[] = [];
  for (const node of content) {
    if (merged.length > 0) {
      const last = merged[merged.length - 1];
      if (areMarksEqual(last.marks, node.marks)) {
        last.text += node.text;
        continue;
      }
    }
    merged.push({ ...node });
  }
  return merged;
}

// --- 6. DOM PARSING ---

export function parseDOMToContent(
  el: HTMLElement,
  previousContent: InlineNode[]
): InlineNode[] {
  const draftNodes: Omit<InlineNode, "id">[] = [];

  function walk(node: Node, currentMarks: Mark[]) {
    if (node.nodeType === Node.TEXT_NODE) {
      // ... existing text logic
      const text = node.textContent || "";
      if (text.length > 0) {
        const prev = draftNodes[draftNodes.length - 1];
        if (prev && areMarksEqual(prev.marks, currentMarks)) {
          prev.text += text;
        } else {
          draftNodes.push({ text, marks: [...currentMarks] });
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (
        element.classList.contains("drag-handle") ||
        element.tagName === "SELECT"
      )
        return;

      const newMarks = [...currentMarks];

      // --- EXISTING MARKS ---
      if (
        element.tagName === "STRONG" ||
        element.tagName === "B" ||
        parseInt(element.style.fontWeight) >= 600
      ) {
        newMarks.push({ type: "bold" });
      }
      if (element.tagName === "EM" || element.tagName === "I")
        newMarks.push({ type: "italic" });
      if (element.tagName === "U") newMarks.push({ type: "underline" });
      if (element.tagName === "CODE") newMarks.push({ type: "code" });

      // --- NEW: STRIKETHROUGH ---
      if (
        element.tagName === "S" ||
        element.tagName === "DEL" ||
        element.style.textDecoration.includes("line-through")
      ) {
        newMarks.push({ type: "strike" });
      }

      element.childNodes.forEach((child) => walk(child, newMarks));
    }
  }
  walk(el, []);

  // ... (Rest of function remains identical) ...
  // Optimization
  if (
    previousContent.length === 1 &&
    draftNodes.length === 1 &&
    areMarksEqual(previousContent[0].marks, draftNodes[0].marks)
  ) {
    return [
      {
        id: previousContent[0].id,
        text: draftNodes[0].text,
        marks: draftNodes[0].marks,
      },
    ];
  }

  return draftNodes.map((draft, index) => {
    const prevNode = previousContent[index];
    if (prevNode && areMarksEqual(prevNode.marks, draft.marks)) {
      return { id: prevNode.id, text: draft.text, marks: draft.marks };
    }
    return { id: uid(), text: draft.text, marks: draft.marks };
  });
}

// --- 7. HELPERS ---

export function getTextLength(content: InlineNode[]) {
  return content.reduce((acc, node) => acc + node.text.length, 0);
}

export function getCaretOffset(root: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(root);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
}

export function setCaretOffset(root: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;

  if (root.textContent?.length === 0) {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }

  let currentOffset = 0;
  const range = document.createRange();

  function walk(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const length = node.textContent?.length || 0;
      if (currentOffset + length >= offset) {
        range.setStart(node, offset - currentOffset);
        range.setEnd(node, offset - currentOffset);
        return true;
      }
      currentOffset += length;
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        if (walk(node.childNodes[i])) return true;
      }
    }
    return false;
  }

  const found = walk(root);
  if (found) {
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    const r = document.createRange();
    r.selectNodeContents(root);
    r.collapse(false);
    selection.removeAllRanges();
    selection.addRange(r);
  }
}
