import type { LucideIcon } from "lucide-react"

export type NavSubItem = {
  title: string
  href: string
  /** When true, only exact pathname matches (avoids /llm matching /llm/playground). */
  exact?: boolean
  visible?: boolean | (() => boolean)
  disabled?: boolean | (() => boolean)
}

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  exact?: boolean
  visible?: boolean | (() => boolean)
  disabled?: boolean | (() => boolean)
}

export type NavItemWithChildren = {
  title: string
  icon: LucideIcon
  items: NavSubItem[]
  visible?: boolean | (() => boolean)
  disabled?: boolean | (() => boolean)
}

export type NavLeafEntry = NavItem | NavItemWithChildren

export type NavGroup = {
  label: string
  items: NavLeafEntry[]
}

export type NavEntry = NavLeafEntry | NavGroup
