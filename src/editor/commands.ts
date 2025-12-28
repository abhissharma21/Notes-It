import type { Command } from "./types";

export const COMMANDS: Command[] = [
  {
    label: "Text",
    type: "paragraph",
    category: "Basic blocks",
    description: "Plain text.",
  },
  {
    label: "Heading 1",
    type: "h1",
    category: "Headings",
    description: "Large heading.",
  },
  {
    label: "Heading 2",
    type: "h2",
    category: "Headings",
    description: "Medium heading.",
  },
  {
    label: "Heading 3",
    type: "h3",
    category: "Headings",
    description: "Small heading.",
  },
  {
    label: "Bulleted list",
    type: "bullet-list",
    category: "Basic blocks",
    description: "Simple bulleted list.",
  },
  {
    label: "Numbered list",
    type: "numbered-list",
    category: "Basic blocks",
    description: "List with numbers.",
  },
  {
    label: "Quote",
    type: "quote",
    category: "Basic blocks",
    description: "Block quote.",
  },
  {
    label: "Divider",
    type: "divider",
    category: "Media / Layout",
    description: "Visual separator.",
  },
  {
    label: "Code",
    type: "code",
    category: "Media / Layout",
    description: "Code snippet.",
  },
];
