export type MarkType = 
  | "bold" 
  | "italic" 
  | "underline" 
  | "strike" 
  | "code" 
  | "highlight";

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
  | "divider"
  | "drawio"
  | "image";

export interface Block {
  id: string;
  type: BlockType;
  content: InlineNode[];
  children: Block[];
  isOpen: boolean;
  props: {
    level?: 1 | 2 | 3;
    language?: string;
    align?: "left" | "center" | "right";
    xml?: string;
    previewUrl?: string;
    src?: string;
    alt?: string;
    caption?: InlineNode[];
    width?: number;
    textColor?: string;       
    backgroundColor?: string; 
    [key: string]: any;
  };
}

export interface EditorSelection {
  start: { blockId: string; offset: number };
  end: { blockId: string; offset: number };
  isCollapsed: boolean;
}

export type EditorOp =
  | { type: "insert_text"; blockId: string; offset: number; text: string; }
  | { type: "delete_text"; blockId; offset: number; length: number; }
  | { type: "add_block"; block: Block; afterBlockId: string | null; parentId: string | null; }
  | { type: "delete_block"; blockId: string; }
  | { type: "update_block_props"; blockId: string; props: Partial<Block["props"]>; }
  | { type: "set_block_type"; blockId: string; newType: BlockType; };

export interface RemoteCursor {
  clientId: string;
  blockId: string;
  offset: number;
  color: string;
  name: string;
  lastActive: number;
}

export type CollabMessage = 
  | { type: "init"; payload: { id: string; color: string; name: string } }
  | { type: "op"; payload: EditorOp }
  | { type: "cursor"; payload: RemoteCursor }
  | { type: "client_disconnect"; payload: { clientId: string } };