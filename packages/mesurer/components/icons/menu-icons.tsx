import type { SVGProps } from "react"

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

const IconBase = ({ size = 24, ...props }: IconProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" onDragStart={(event) => event.preventDefault()} {...props} />
)

export const CaretDownIcon = ({ size = 8, ...props }: IconProps) => <IconBase size={size} {...props}><path d="M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z" /></IconBase>
export const CheckIcon = ({ size = 12, ...props }: IconProps) => <IconBase size={size} {...props}><path d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z" /></IconBase>
export const MinusIcon = ({ size = 12, ...props }: IconProps) => <IconBase size={size} {...props}><path d="M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128Z" /></IconBase>
