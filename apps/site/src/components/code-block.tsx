import type { ReactNode } from "react";

type CodeBlockProps = {
  children: ReactNode;
  as?: "code" | "pre";
};

export default function CodeBlock({ children, as = "code" }: CodeBlockProps) {
  const className =
    "bg-subtle font-mono text-[13px] text-strong w-full py-2 px-3";

  if (as === "pre") {
    return (
      <pre className={`${className} whitespace-pre-wrap`}>
        <code className="font-mono text-[13px] text-strong w-full">
          {children}
        </code>
      </pre>
    );
  }

  return <code className={className}>{children}</code>;
}
