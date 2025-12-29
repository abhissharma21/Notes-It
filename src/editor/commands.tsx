import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
} from "lucide-react";
import type { Command } from "./types";

export const COMMANDS: Command[] = [
  {
    type: "paragraph",
    label: "Text",
    description: "Just start writing with plain text.",
    icon: Type,
  },
  {
    type: "h1",
    label: "Heading 1",
    description: "Big section heading.",
    icon: Heading1,
    shortcut: "#",
  },
  {
    type: "h2",
    label: "Heading 2",
    description: "Medium section heading.",
    icon: Heading2,
    shortcut: "##",
  },
  {
    type: "h3",
    label: "Heading 3",
    description: "Small section heading.",
    icon: Heading3,
    shortcut: "###",
  },
  {
    type: "bullet-list",
    label: "Bulleted list",
    description: "Create a simple bulleted list.",
    icon: List,
    shortcut: "-",
  },
  {
    type: "numbered-list",
    label: "Numbered list",
    description: "Create a list with numbering.",
    icon: ListOrdered,
    shortcut: "1.",
  },
  {
    type: "quote",
    label: "Quote",
    description: "Capture a quote.",
    icon: Quote,
    shortcut: '"',
  },
  {
    type: "code",
    label: "Code",
    description: "Capture a code snippet.",
    icon: Code,
    shortcut: "```",
  },
  {
    type: "divider",
    label: "Divider",
    description: "Visually divide blocks.",
    icon: Minus,
    shortcut: "---",
  },
];

/**
 * Returns the preview component for the side panel
 */
export function getPreview(cmd: Command) {
  // Common container for the "graphic" part of the preview
  const Graphic = ({ children }: { children: React.ReactNode }) => (
    <div className="preview-graphic">{children}</div>
  );

  switch (cmd.type) {
    case "paragraph":
      return (
        <Graphic>
          <div className="preview-text-sm">
            To be the <span className="italic">foremost</span> driver who
            pioneers the latest technological{" "}
            <span className="italic">breakthroughs</span> to propel our society
            toward the perfection of{" "}
            <span className="italic">science and art</span>.
          </div>
        </Graphic>
      );
    case "h1":
      return (
        <Graphic>
          <div className="preview-h1">Heading 1</div>
        </Graphic>
      );
    case "h2":
      return (
        <Graphic>
          <div className="preview-h2">Heading 2</div>
        </Graphic>
      );
    case "h3":
      return (
        <Graphic>
          <div className="preview-h3">Heading 3</div>
        </Graphic>
      );
    case "bullet-list":
      return (
        <Graphic>
          <ul className="preview-ul">
            <li>List item one</li>
            <li>List item two</li>
            <li>List item three</li>
          </ul>
        </Graphic>
      );
    case "numbered-list":
      return (
        <Graphic>
          <ol className="preview-ol">
            <li>First item</li>
            <li>Second item</li>
            <li>Third item</li>
          </ol>
        </Graphic>
      );
    case "quote":
      return (
        <Graphic>
          <div className="preview-quote">
            "The only way to do great work is to love what you do."
          </div>
        </Graphic>
      );
    case "code":
      return (
        <Graphic>
          <div className="preview-code">
            <span style={{ color: "#cc99cd" }}>const</span> a = 10;
            <br />
            console.<span style={{ color: "#f08d49" }}>log</span>(a);
          </div>
        </Graphic>
      );
    case "divider":
      return (
        <Graphic>
          <div className="preview-divider"></div>
        </Graphic>
      );
    default:
      return null;
  }
}
