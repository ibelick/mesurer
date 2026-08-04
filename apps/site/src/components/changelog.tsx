import changelog from "../../../../packages/mesurer/CHANGELOG.md?raw";
import type { ReactNode } from "react";

type ChangelogListItem = { text: string; children?: string[] };

type ChangelogBlock =
  | { type: "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: ChangelogListItem[] };

function renderInlineMarkdown(text: string): ReactNode {
  return text.split(/(\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!match) return part;

    return (
      <a
        key={index}
        href={match[2]}
        target="_blank"
        rel="noreferrer"
        className="underline decoration-current/40 underline-offset-2 hover:decoration-current"
      >
        {match[1]}
      </a>
    );
  });
}

function parseChangelog(raw: string) {
  const lines = raw.split(/\r?\n/);
  const blocks: ChangelogBlock[] = [];
  let listItems: ChangelogListItem[] = [];
  let lastItem: ChangelogListItem | null = null;

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

const changelogBlocks = parseChangelog(changelog);

export default function Changelog() {
  return (
    <div className="flex flex-col gap-6">
      {changelogBlocks.map((block, index) => {
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

        return (
          <p key={index} className="text-muted">
            {renderInlineMarkdown(block.text)}
          </p>
        );
      })}
    </div>
  );
}
