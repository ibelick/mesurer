import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const IconBase = ({ size = 16, ...props }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props} />
)

export const LayoutColumnsIcon = ({ size = 16, ...props }: IconProps) => (
  <IconBase size={size} {...props}>
    <path d="M2.5 2.5h2.5v11H2.5zM6.75 2.5h2.5v11h-2.5zM11 2.5h2.5v11H11z" stroke="currentColor" strokeWidth="1.25" />
  </IconBase>
)

export const LayoutRowsIcon = ({ size = 16, ...props }: IconProps) => (
  <IconBase size={size} {...props}>
    <path d="M2.5 2.5h11v2.5h-11zM2.5 6.75h11v2.5h-11zM2.5 11h11v2.5h-11z" stroke="currentColor" strokeWidth="1.25" />
  </IconBase>
)

export const LayoutGridIcon = ({ size = 16, ...props }: IconProps) => (
  <IconBase size={size} {...props}>
    <path d="M2.5 2.5h11v11h-11zM2.5 6.75h11M2.5 11h11M6.75 2.5v11M11 2.5v11" stroke="currentColor" strokeWidth="1.25" />
  </IconBase>
)

export const PlusIcon = ({ size = 12, ...props }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" {...props}>
    <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
  </svg>
)

export const EyeIcon = ({ size = 14, ...props }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
    <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8Z" stroke="currentColor" strokeWidth="1.25" />
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.25" />
  </svg>
)

export const EyeOffIcon = ({ size = 14, ...props }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
    <path d="m2 2 12 12M6.2 6.3A2.5 2.5 0 0 0 8 10.5M9.7 9.8A2.5 2.5 0 0 0 8 5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    <path d="M4.1 4.6C2.5 5.7 1.5 8 1.5 8s2.5 4.5 6.5 4.5c1.2 0 2.3-.4 3.2-1M11.7 10.7c1.3-1 2.2-2.7 2.8-2.7 0 0-2.5-4.5-6.5-4.5-.6 0-1.2.1-1.7.3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
  </svg>
)
