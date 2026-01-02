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
  code: { allowMarks: false }, // Critical: Code cannot have marks
  divider: { isVoid: true },
};

// --- 2. SANITIZATION (The Police) ---
export function sanitizeBlock(block: Block): Block {
  const rule = BLOCK_SCHEMA[block.type];
  if (!rule) return { ...block, type: "paragraph" };

  // Rule: Void blocks must be empty
  if (rule.isVoid && block.content.length > 0) {
    return { ...block, content: [] };
  }

  // Rule: Code blocks must not have bold/italic marks
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

// --- 5. DOM PARSING (The "Right-to-Left" Fix) ---
function areMarksEqual(a: Mark[], b: Mark[]) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x.type.localeCompare(y.type));
  const sortedB = [...b].sort((x, y) => x.type.localeCompare(y.type));
  return JSON.stringify(sortedA) === JSON.stringify(sortedB);
}

export function parseDOMToContent(
  el: HTMLElement,
  previousContent: InlineNode[]
): InlineNode[] {
  const draftNodes: Omit<InlineNode, "id">[] = [];

  function walk(node: Node, currentMarks: Mark[]) {
    if (node.nodeType === Node.TEXT_NODE) {
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

      element.childNodes.forEach((child) => walk(child, newMarks));
    }
  }
  walk(el, []);

  // Optimization: Reuse ID if structure matches (Fixes typing direction)
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

export function getTextLength(content: InlineNode[]) {
  return content.reduce((acc, node) => acc + node.text.length, 0);
}

// --- 6. CURSOR MANAGEMENT ---
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
    // Fallback
    const r = document.createRange();
    r.selectNodeContents(root);
    r.collapse(false);
    selection.removeAllRanges();
    selection.addRange(r);
  }
}
