type MarkdownListItem = { text: string; children?: string[] };

type MarkdownBlock =
  | { type: "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: MarkdownListItem[] };

function parseMarkdown(raw: string) {
  const lines = raw.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let listItems: MarkdownListItem[] = [];
  let lastItem: MarkdownListItem | null = null;

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: "ul", items: listItems });
      listItems = [];
      lastItem = null;
    }
  };

  for (const line of lines) {
    if (line.startsWith("# ")) {
      flushList();
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith("### ")) {
      flushList();
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith("  - ") && lastItem) {
      const childItem = line.slice(4).trim();
      if (!lastItem.children) {
        lastItem.children = [];
      }
      lastItem.children.push(childItem);
      continue;
    }

    if (line.startsWith("- ")) {
      const item = { text: line.slice(2).trim() };
      listItems.push(item);
      lastItem = item;
      continue;
    }

    if (line.trim() === "") {
      flushList();
      continue;
    }

    flushList();
    blocks.push({ type: "p", text: line.trim() });
  }

  flushList();

  return blocks;
}

const URL_PATTERN = /^https?:\/\/.+/i;

function renderInlineMarkdown(text: string): ReactNode {
  return text.split(/(\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!match) return part;

    const isExternal = /^https?:\/\//i.test(match[2]);
    return (
      <a
        key={index}
        href={match[2]}
        {...(isExternal ? { target: "_blank", rel: "noreferrer" } : {})}
        className="underline decoration-current/40 underline-offset-2 hover:decoration-current"
      >
        {match[1]}
      </a>
    );
  });
}

export default function MarkdownDoc({ source }: { source: string }) {
  const blocks = parseMarkdown(source);

  return (
    <div className="flex flex-col gap-6">
      {blocks.map((block, index) => {
        if (block.type === "h2") {
          return (
            <h2 key={index} className="font-medium text-strong">
              {renderInlineMarkdown(block.text)}
            </h2>
          );
        }

        if (block.type === "h3") {
          return (
            <h3 key={index} className="font-[450] text-strong">
              {renderInlineMarkdown(block.text)}
            </h3>
          );
        }

        if (block.type === "ul") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5 text-muted">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  {renderInlineMarkdown(item.text)}
                  {item.children && item.children.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-muted">
                      {item.children.map((child, childIndex) => (
                        <li key={childIndex}>{renderInlineMarkdown(child)}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          );
        }

        if (URL_PATTERN.test(block.text)) {
          return (
            <p key={index} className="text-muted">
              <a
                href={block.text}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-strong"
              >
                {block.text}
              </a>
            </p>
          );
        }

        return (
          <p key={index} className="text-muted">
            {renderInlineMarkdown(block.text)}
          </p>
        );
      })}
    </div>
  );
}
import type { ReactNode } from "react";
