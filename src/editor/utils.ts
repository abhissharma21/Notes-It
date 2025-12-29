import type { Block, BlockType } from "./types";

export function createBlock(overrides?: Partial<Block>): Block {
  return {
    id: crypto.randomUUID(),
    type: "paragraph",
    text: "",
    children: [],
    isOpen: true,
    ...overrides,
  };
}

// --- Tree Helpers ---

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
    if (blocks[i].id === id) {
      return { blocks, index: i, node: blocks[i] };
    }
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
    if (block.id === id) {
      return update(block);
    }
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
    .map((b) => ({
      ...b,
      children: deleteBlockFromTree(b.children, id),
    }));
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
      const updatedChildren = insertAfterInTree(
        block.children,
        anchorId,
        newBlock
      );
      if (updatedChildren !== block.children) {
        newBlocks[newBlocks.length - 1] = {
          ...block,
          children: updatedChildren,
        };
      }
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
        const updatedChildren = insertBeforeInTree(
          block.children,
          anchorId,
          newBlock
        );
        if (updatedChildren !== block.children) {
          newBlocks[newBlocks.length - 1] = {
            ...block,
            children: updatedChildren,
          };
        }
      }
    }
  }
  return newBlocks;
}
