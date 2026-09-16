import type { AnchorHTMLAttributes, ReactNode } from "react";

type ButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: "primary" | "secondary";
  children: ReactNode;
};

export default function Button({ variant = "primary", className = "", children, ...props }: ButtonProps) {
  const variantClassName = variant === "primary"
    ? "min-h-9 gap-1 px-[17px] font-medium transition-opacity bg-strong text-bg shadow-[inset_0_1px_rgb(255_255_255_/_8%)] hover:opacity-90"
    : "gap-1.5 px-5 py-2.5 font-[450] transition-colors bg-white text-neutral-900 border border-neutral-200 hover:bg-neutral-100";

  return (
    <a
      {...props}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full text-base leading-none duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-strong active:opacity-75 ${variantClassName} ${className}`}
    >
      {children}
    </a>
  );
}
