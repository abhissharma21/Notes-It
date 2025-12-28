export function createBlock(
  text = "",
  type: "paragraph" | "heading" = "paragraph"
) {
  return {
    id: Math.random().toString(36).slice(2),
    type,
    text,
  };
}
