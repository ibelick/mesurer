import type { AnchorHTMLAttributes, ReactNode } from "react";

type ButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: "primary" | "secondary" | "muted";
  size?: "default" | "large";
  children: ReactNode;
};

export default function Button({ variant = "primary", size = "default", className = "", children, ...props }: ButtonProps) {
  const sizeClassName = size === "large" ? "h-11 gap-2 px-5 text-base" : "";
  const variantClassName = variant === "primary"
    ? "body-md-emphasis min-h-9 gap-1 px-4 transition-opacity bg-strong text-bg hover:opacity-90"
    : variant === "muted"
      ? "body-md-emphasis gap-1.5 px-5 py-2.5 transition-colors bg-subtle text-strong border border-border hover:bg-border-strong"
      : "body-md-emphasis gap-1.5 px-5 py-2.5 transition-colors bg-white text-strong border border-border-strong hover:bg-strong-bg";

  return (
    <a
      {...props}
      className={`inline-flex select-none items-center justify-center whitespace-nowrap rounded-full duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-strong active:opacity-75 ${variantClassName} ${sizeClassName} ${className}`}
    >
      {children}
    </a>
  );
}
