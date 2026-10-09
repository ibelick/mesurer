import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number
  strokePx?: number
}

// A wide screen with a phone in front of it.
export const ResponsiveIcon = ({ size = 20, strokePx = 1, ...props }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true" {...props}>
    <g fill="none" stroke="currentColor" strokeWidth={(strokePx * 256) / size} strokeLinecap="round" strokeLinejoin="round">
      <path d="M124 176H52a16 16 0 0 1-16-16V72a16 16 0 0 1 16-16h132a16 16 0 0 1 16 16v20" />
      <path d="M168 120h40a12 12 0 0 1 12 12v64a12 12 0 0 1-12 12h-40a12 12 0 0 1-12-12v-64a12 12 0 0 1 12-12Z" />
    </g>
  </svg>
)
