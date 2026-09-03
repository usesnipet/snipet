import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import type { ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncate(text: string, maxLength: number) {
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}