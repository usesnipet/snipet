import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import type { ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function mapBy<T, K extends string | number | symbol>(array: T[], key: (item: T) => K): Map<K, T> {
  return array.reduce((acc, item) => {
    acc.set(key(item), item);
    return acc;
  }, new Map<K, T>());
}