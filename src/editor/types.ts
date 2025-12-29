import type { LucideIcon } from "lucide-react";

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
  language?: string;
  children: Block[];
  isOpen?: boolean;
}

export interface Command {
  type: BlockType;
  label: string;
  description: string;
  icon: LucideIcon;
  shortcut?: string;
}
