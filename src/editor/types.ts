export type BlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "bullet-list"
  | "numbered-list"
  | "quote"
  | "code"
  | "divider";

export interface Block {
  id: string;
  type: BlockType;
  text: string;
}

export type EditorState = {
  blocks: Block[];
};

export type CommandCategory = "Basic blocks" | "Headings" | "Media / Layout";

export type Command = {
  label: string;
  type: BlockType;
  category: CommandCategory;
  description?: string;
};
