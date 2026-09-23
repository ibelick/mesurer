import type { ReactNode, SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number
  strokePx?: number
  fill?: number
}

const strokeFor = (size: number, strokePx: number, fill: number) => (strokePx * 256) / size / fill

const FrameIcon = ({
  size = 20,
  strokePx = 1,
  fill = 1,
  children,
  ...props
}: IconProps & { children: ReactNode }) => {
  const stroke = strokeFor(size, strokePx, fill)
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true" {...props}>
      <path
        d="M64 48H192a16 16 0 0 1 16 16v128a16 16 0 0 1-16 16H64a16 16 0 0 1-16-16V64a16 16 0 0 1 16-16Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="butt">
        {children}
      </g>
    </svg>
  )
}

export const LayoutGridIcon = ({ size = 20, strokePx = 1, fill = 1, ...props }: IconProps) => (
  <FrameIcon size={size} strokePx={strokePx} fill={fill} {...props}>
    <path d="M128 48v160M48 128h160" />
  </FrameIcon>
)

export const LayoutColumnsIcon = ({ size = 20, strokePx = 1, fill = 1, ...props }: IconProps) => (
  <FrameIcon size={size} strokePx={strokePx} fill={fill} {...props}>
    <path d="M101.33 48v160M154.67 48v160" />
  </FrameIcon>
)

export const LayoutRowsIcon = ({ size = 20, strokePx = 1, fill = 1, ...props }: IconProps) => (
  <FrameIcon size={size} strokePx={strokePx} fill={fill} {...props}>
    <path d="M48 101.33h160M48 154.67h160" />
  </FrameIcon>
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
