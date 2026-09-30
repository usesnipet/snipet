import type { NavEntry, NavGroup, NavItemWithChildren, NavLeafEntry, NavSubItem } from "./types";

export function isNavGroup(item: NavEntry): item is NavGroup {
  return "label" in item
}

export function isNavItemWithChildren(item: NavLeafEntry): item is NavItemWithChildren {
  return "items" in item
}

export function isNavActive(pathname: string, href: string, exact?: boolean) {
  if (href === "/") return pathname === "/";
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavGroupActive(pathname: string, items: NavSubItem[]) {
  return items.some((item) => isNavActive(pathname, item.href, item.exact))
}