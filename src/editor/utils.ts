import type { Block } from "./types";

export function createBlock(overrides?: Partial<Block>): Block {
  return {
    id: crypto.randomUUID(),
    type: "paragraph",
    text: "",
    ...overrides,
  };
}
