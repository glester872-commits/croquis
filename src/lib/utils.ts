import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Format a normalised region as inset percentages for absolute layout. */
export function regionToInset(region: {
  x: number
  y: number
  width: number
  height: number
}): {
  left: string
  top: string
  width: string
  height: string
} {
  return {
    left: `${(region.x * 100).toFixed(3)}%`,
    top: `${(region.y * 100).toFixed(3)}%`,
    width: `${(region.width * 100).toFixed(3)}%`,
    height: `${(region.height * 100).toFixed(3)}%`,
  }
}
