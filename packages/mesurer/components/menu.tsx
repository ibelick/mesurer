import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type ReactNode } from "react"
import { cn } from "../core/utils"

type MenuSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
}

export const FloatingSurface = forwardRef<HTMLDivElement, MenuSurfaceProps>(
  function FloatingSurface({ className, children, ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={cn(
          "mesurer-menu-surface msr:rounded-lg msr:bg-white msr:shadow-floating msr:outline-none msr:focus:outline-none",
          className,
        )}
      >
        {children}
      </div>
    )
  },
)

export const ToolbarFloatingSurface = forwardRef<HTMLDivElement, MenuSurfaceProps>(
  function ToolbarFloatingSurface({ className, children, style, ...props }, ref) {
    return (
      <FloatingSurface
        {...props}
        ref={ref}
        className={cn("msr:pointer-events-auto msr:fixed msr:z-[120]", className)}
        style={{ zIndex: 120, ...style }}
      >
        {children}
      </FloatingSurface>
    )
  },
)

export const MenuSurface = forwardRef<HTMLDivElement, MenuSurfaceProps>(
  function MenuSurface({ className, children, ...props }, ref) {
    return (
      <FloatingSurface
        {...props}
        ref={ref}
        className={cn("msr:z-[70] msr:p-1", className)}
        role="menu"
      >
        {children}
      </FloatingSurface>
    )
  },
)

type ToolbarMenuProps = MenuSurfaceProps & {
  side: "top" | "bottom"
  align?: "left" | "right"
  /** Fixed on the Mesurer root, same stacking as Settings. */
  floating?: boolean
  floatingStyle?: CSSProperties
}

export const ToolbarMenu = forwardRef<HTMLDivElement, ToolbarMenuProps>(function ToolbarMenu(
  { className, side, align = "left", floating = false, floatingStyle, style, children, ...props },
  ref,
) {
  return (
    <MenuSurface
      {...props}
      ref={ref}
      style={floating ? { ...floatingStyle, ...style } : style}
      data-side={side}
      className={cn(
        "mesurer-toolbar-menu msr:flex msr:w-44 msr:flex-col msr:gap-px",
        floating
          ? "msr:pointer-events-auto msr:fixed msr:z-[120]"
          : cn(
              "msr:absolute msr:z-[100]",
              side === "bottom" ? "msr:top-full msr:mt-2" : "msr:bottom-full msr:mb-2",
              align === "left" ? "msr:left-0" : "msr:right-0",
            ),
        className,
      )}
    >
      {children}
    </MenuSurface>
  )
})

type MenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: "neutral" | "accent"
}

export function MenuItem({
  className,
  children,
  variant = "accent",
  role,
  ...props
}: MenuItemProps) {
  return (
    <button
      {...props}
      type="button"
      role={role ?? "menuitem"}
      className={cn(
        "msr:flex msr:w-full msr:items-center msr:rounded-control msr:px-2 msr:py-1.5 msr:text-left msr:text-[11px] msr:leading-4 msr:text-ink-700",
        variant === "accent"
          ? "msr:hover:bg-[#0d99ff] msr:hover:text-white"
          : "msr:hover:bg-ink-50",
        "msr:disabled:cursor-not-allowed msr:disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Toolbar dropdown row: icon, label, shortcut — blue hover like guide/capture menus. */
export function ToolbarMenuItem({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <MenuItem
      {...props}
      variant="accent"
      className={cn(
        "msr:gap-2 msr:rounded-[4px] msr:px-2 msr:py-1 msr:text-ink-700 msr:hover:bg-[#0d99ff] msr:hover:text-white",
        className,
      )}
    >
      {children}
    </MenuItem>
  )
}
