import { type ClassValue, clsx } from "clsx"
import { twMerge as merge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs))
}

export function formatDate(input: string | number | Date): string {
  const date = new Date(input)
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function absoluteUrl(path: string) {
  return `${window.location.origin}${path}`
} 