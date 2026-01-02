import type { Block, BlockType, InlineNode, MarkType } from "./types";

interface BlockRule {
  isVoid?: boolean; // If true, block cannot contain text (pure container)
  allowMarks?: boolean; // If false, strips all styling (Code)
  isContainer?: boolean; // If true, renders children inside the UI chrome (Quote)
}

const BLOCK_SCHEMA: Record<BlockType, BlockRule> = {
  paragraph: { allowMarks: true },
  h1: { allowMarks: true },
  h2: { allowMarks: true },
  h3: { allowMarks: true },
  "bullet-list": { allowMarks: true, isContainer: true }, // Lists hold children
  "numbered-list": { allowMarks: true, isContainer: true },
  quote: { allowMarks: true, isContainer: true }, // Quotes hold paragraphs
  code: { allowMarks: false }, // NO BOLD/ITALIC
  divider: { isVoid: true },
};

export function sanitizeBlock(block: Block): Block {
  const rule = BLOCK_SCHEMA[block.type];
  if (!rule) return { ...block, type: "paragraph" };

  // 1. Enforce Void
  if (rule.isVoid && block.content.length > 0) {
    return { ...block, content: [] };
  }

  // 2. Enforce No Marks (Code Block)
  if (rule.allowMarks === false) {
    const hasMarks = block.content.some((node) => node.marks.length > 0);
    if (hasMarks) {
      const cleanContent = block.content.map((node) => ({
        ...node,
        marks: [],
      }));
      return { ...block, content: cleanContent };
    }
  }

  return block;
}
