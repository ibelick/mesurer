import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number
}

const IconBase = ({ size = 24, ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    aria-hidden="true"
    onDragStart={(event) => event.preventDefault()}
    {...props}
  />
)

const CURSOR_PATH =
  "M166.59,134.1a1.91,1.91,0,0,1-.55-1.79,2,2,0,0,1,1.08-1.42l46.25-17.76.24-.1A14,14,0,0,0,212.38,87L52.29,34.7A13.95,13.95,0,0,0,34.7,52.29L87,212.38a13.82,13.82,0,0,0,12.6,9.6c.23,0,.46,0,.69,0A13.84,13.84,0,0,0,113,213.61a2.44,2.44,0,0,0,.1-.24l17.76-46.25a2,2,0,0,1,3.21-.53l51.31,51.31a14,14,0,0,0,19.8,0l12.69-12.69a14,14,0,0,0,0-19.8Zm42.82,62.63-12.68,12.68a2,2,0,0,1-2.83,0L142.59,158.1a14,14,0,0,0-22.74,4.32,2.44,2.44,0,0,0-.1.24L102,208.91a2,2,0,0,1-3.61-.26L46.11,48.57a1.87,1.87,0,0,1,.47-2A1.92,1.92,0,0,1,47.93,46a2.22,2.22,0,0,1,.64.1L208.65,98.38a2,2,0,0,1,.26,3.61l-46.25,17.76-.24.1a14,14,0,0,0-4.32,22.74h0l51.31,51.31A2,2,0,0,1,209.41,196.73Z"

const CURSOR_COMPOSITE_TRANSFORM = "translate(72 72) scale(0.72)"

export const CursorIcon = ({ size = 20, ...props }: IconProps) => (
  <IconBase size={size} {...props}>
    <path d={CURSOR_PATH} />
  </IconBase>
)

export const BoxSelectIcon = ({ size = 20, ...props }: IconProps) => (
  <IconBase size={size} {...props}>
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M64 36H48a12 12 0 0 0-12 12v16M96 36h28M148 36h16M176 64V48a12 12 0 0 0-12-12h-16M36 96v28M36 148v16M64 176H48a12 12 0 0 1-12-12v-16"
    />
    <path transform={CURSOR_COMPOSITE_TRANSFORM} d={CURSOR_PATH} />
  </IconBase>
)

export const RulerIcon = ({ size = 20, ...props }: IconProps) => (
  <IconBase size={size} {...props}>
    <path d="M233.91,74.79,181.22,22.1a14,14,0,0,0-19.8,0L22.09,161.41a14,14,0,0,0,0,19.8L74.78,233.9a14,14,0,0,0,19.8,0L233.91,94.59A14,14,0,0,0,233.91,74.79ZM225.42,86.1,86.1,225.41h0a2,2,0,0,1-2.83,0L30.58,172.73a2,2,0,0,1,0-2.83L64,136.48l27.76,27.76a6,6,0,1,0,8.48-8.48L72.48,128,96,104.48l27.76,27.76a6,6,0,0,0,8.48-8.48L104.48,96,128,72.49l27.76,27.75a6,6,0,0,0,8.48-8.48L136.49,64,169.9,30.59a2,2,0,0,1,2.83,0l52.69,52.68A2,2,0,0,1,225.42,86.1Z" />
  </IconBase>
)

export const ArrowIcon = ({ size = 20, ...props }: IconProps) => (
  <IconBase size={size} {...props}>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
      d="M40 128h160m0 0-56-56m56 56-56 56"
    />
  </IconBase>
)

export const XrayIcon = ({ size = 20, ...props }: IconProps) => (
  <IconBase size={size} {...props}>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="12"
      strokeOpacity="0.78"
      d="M76 48h96a16 16 0 0 1 16 16v96a16 16 0 0 1-16 16H76a16 16 0 0 1-16-16V64a16 16 0 0 1 16-16Zm32 32h96a16 16 0 0 1 16 16v96a16 16 0 0 1-16 16h-96a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16Z"
    />
  </IconBase>
)

export const RulersIcon = ({ size = 20, ...props }: IconProps) => (
  <IconBase size={size} {...props}>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="12"
      d="M48 208V48h160M80 48v24m32-24v24m32-24v24m32-24v24M48 80h24M48 112h24m-24 32h24m-24 32h24"
    />
  </IconBase>
)

export const CaretDownIcon = ({ size = 8, ...props }: IconProps) => (
  <IconBase size={size} {...props}>
    <path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" />
  </IconBase>
)

export const CheckIcon = ({ size = 12, ...props }: IconProps) => (
  <IconBase size={size} {...props}>
    <path d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z" />
  </IconBase>
)

export const MinusIcon = ({ size = 12, ...props }: IconProps) => (
  <IconBase size={size} {...props}>
    <path d="M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128Z" />
  </IconBase>
)

// "Aa" glyph for the text-style inspector toggle. Rendered as text inside
// the icon's viewBox so it visually matches sibling SVG toolbar icons.
export const TextInspectorIcon = ({ size = 20, ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 256 256"
    fill="currentColor"
    aria-hidden="true"
    onDragStart={(event) => event.preventDefault()}
    {...props}
  >
    <text
      x="50%"
      y="60%"
      textAnchor="middle"
      dominantBaseline="middle"
      fill="currentColor"
      fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
      fontWeight={300}
      fontSize={220}
    >
      Aa
    </text>
  </svg>
)

export const TextIcon = ({ size = 20, ...props }: IconProps) => (
  <IconBase size={size} {...props}>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="16"
      d="M48 64h160M128 64v128M88 192h80"
    />
  </IconBase>
)

export const ColorPickerIcon = ({ size = 20, ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    {...props}
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      transform="translate(-1.44 -1.44) scale(1.12)"
      d="M15.16 5.658a2.25 2.25 0 0 1 3.18.001l.155.17a2.25 2.25 0 0 1 0 2.84l-.154.172-1.696 1.692a1.5 1.5 0 0 1 .02 1.913l-.104.114a1.5 1.5 0 0 1-2.007.103l-.02-.018-4.443 4.447a2.24 2.24 0 0 1-1.716.65l-.814.815a1.5 1.5 0 0 1-2.121-2.121l.816-.818a2.25 2.25 0 0 1 .653-1.708l4.443-4.446a1.5 1.5 0 0 1 .088-2.025l.114-.103a1.5 1.5 0 0 1 1.91.015zm-7.544 8.959a1.25 1.25 0 0 0-.358 1.021c.021.197-.014.406-.154.546l-.958.96a.5.5 0 0 0 .708.706l.955-.956c.14-.14.352-.176.55-.153.364.042.745-.077 1.025-.356l4.438-4.442-1.767-1.767zm10.018-8.251a1.25 1.25 0 0 0-1.768 0l-1.782 1.78-.065.06a.87.87 0 0 1-1.165-.06.5.5 0 0 0-.707.707l3 3a.5.5 0 0 0 .628.064l.079-.064a.5.5 0 0 0 0-.707l-.004-.004a.873.873 0 0 1 .004-1.23l1.78-1.778a1.25 1.25 0 0 0 0-1.768"
      clipRule="evenodd"
    />
  </svg>
)

export const GearIcon = ({ size = 20, ...props }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="2 2 20 20"
    fill="none"
    {...props}
  >
    <path
        d="M10.6504 5.81117C10.9939 4.39628 13.0061 4.39628 13.3496 5.81117C13.5715 6.72517 14.6187 7.15891 15.4219 6.66952C16.6652 5.91193 18.0881 7.33479 17.3305 8.57815C16.8411 9.38134 17.2748 10.4285 18.1888 10.6504C19.6037 10.9939 19.6037 13.0061 18.1888 13.3496C17.2748 13.5715 16.8411 14.6187 17.3305 15.4219C18.0881 16.6652 16.6652 18.0881 15.4219 17.3305C14.6187 17.2748 13.5715 16.8411 13.3496 18.1888C13.0061 19.6037 10.9939 19.6037 10.6504 18.1888C10.4285 17.2748 9.38135 16.8411 8.57815 17.3305C7.33479 18.0881 5.91193 16.6652 6.66952 15.4219C7.15891 14.6187 6.72517 13.5715 5.81117 13.3496C4.39628 13.0061 4.39628 10.9939 5.81117 10.6504C6.72517 10.4285 7.15891 9.38134 6.66952 8.57815C5.91193 7.33479 7.33479 5.91192 8.57815 6.66952C9.38135 6.72517 10.4285 6.72517 10.6504 5.81117Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1" />
  </svg>
)

export const CameraIcon = ({ size = 20, ...props }: IconProps) => (
  <IconBase size={size} {...props}>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="12"
      d="M216 80h-40l-16-24H96L80 80H40a16 16 0 0 0-16 16v96a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V96a16 16 0 0 0-16-16Z"
    />
    <circle
      cx="128"
      cy="136"
      r="36"
      fill="none"
      stroke="currentColor"
      strokeWidth="12"
    />
  </IconBase>
)
