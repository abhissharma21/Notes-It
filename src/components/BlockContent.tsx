import React from "react";
import type { InlineNode } from "../types";

const Leaf = ({ node }: { node: InlineNode }) => {
  let children: React.ReactNode = node.text;

  if (node.marks.some((m) => m.type === "bold")) {
    children = <strong>{children}</strong>;
  }
  if (node.marks.some((m) => m.type === "italic")) {
    children = <em className="italic">{children}</em>;
  }
  if (node.marks.some((m) => m.type === "underline")) {
    children = <u>{children}</u>; // <--- FIX: Native tag
  }
  if (node.marks.some((m) => m.type === "strike")) {
    children = <s>{children}</s>;
  }
  if (node.marks.some((m) => m.type === "code")) {
    children = (
      <code className="bg-gray-800 text-red-400 rounded px-1 text-sm font-mono">
        {children}
      </code>
    );
  }

  return (
    <span data-node-id={node.id} className="leaf-node">
      {children}
    </span>
  );
};

export default function BlockContent({ content }: { content: InlineNode[] }) {
  if (!content || content.length === 0) {
    return <br />;
  }

  return (
    <>
      {content.map((node) => (
        <Leaf key={node.id} node={node} />
      ))}
    </>
  );
}
