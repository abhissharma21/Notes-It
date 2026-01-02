export type MarkType = "bold" | "italic" | "underline" | "code" | "highlight";

export interface Mark {
  type: MarkType;
  attrs?: Record<string, any>;
}

export interface InlineNode {
  id: string;
  text: string;
  marks: Mark[];
}

export type BlockType =
  | "paragraph"
  | "heading"
  | "bullet-list"
  | "numbered-list"
  | "quote"
  | "code"
  | "divider";

export interface Block {
  id: string;
  type: BlockType;
  content: InlineNode[];
  children: Block[];
  isOpen: boolean;
  props: {
    level?: 1 | 2 | 3;
    language?: string;
    [key: string]: any;
  };
}

export interface EditorSelection {
  start: { blockId: string; offset: number };
  end: { blockId: string; offset: number };
  isCollapsed: boolean;
}
