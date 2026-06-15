"use client"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "@/components/ui/link";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu,
  SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton,
  SidebarMenuSubItem
} from "@/components/ui/sidebar";
import { useTheme } from "@/context/theme-provider";
import { ChevronRight, ChevronsUpDown, Home, Moon, Settings, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Version } from "./version";

import type { LucideIcon } from "lucide-react";
type NavSubItem = {
  title: string
  href: string
  /** When true, only exact pathname matches (avoids /llm matching /llm/playground). */
  exact?: boolean
}

type NavItem = {
  title: string
  href: string
  icon: LucideIcon
}

type NavItemWithChildren = {
  title: string
  icon: LucideIcon
  items: NavSubItem[]
}

type NavEntry = NavItem | NavItemWithChildren

const navItems: NavEntry[] = [
  {
    title: "Home",
    href: "/",
    icon: Home,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

function isNavItemWithChildren(item: NavEntry): item is NavItemWithChildren {
  return "items" in item
}

function isNavActive(pathname: string, href: string, exact?: boolean) {
  if (href === "/") return pathname === "/";
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isNavGroupActive(pathname: string, items: NavSubItem[]) {
  return items.some((item) => isNavActive(pathname, item.href, item.exact))
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const { setTheme, theme } = useTheme();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <img src="/favicon.svg" alt="Snipet" className="size-7 shrink-0" />
          <p className="text-sm font-semibold group-data-[collapsible=icon]:hidden">My app</p>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) =>
                isNavItemWithChildren(item) ? (
                  <Collapsible
                    key={item.title}
                    asChild
                    defaultOpen={isNavGroupActive(pathname, item.items)}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={isNavGroupActive(pathname, item.items)}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                          <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.items.map((subItem) => (
                            <SidebarMenuSubItem key={subItem.href}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isNavActive(pathname, subItem.href, subItem.exact)}
                              >
                                <Link href={subItem.href}>
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isNavActive(pathname, item.href)}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="justify-center flex">
                <SidebarMenuBadge>
                  <Version />
                </SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem className="mt-2">
                <DropdownMenu>
                  <DropdownMenuTrigger className="w-full" asChild>
                    <SidebarMenuButton
                      size="lg"
                      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                      <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                        {theme === "light" ? <Sun /> : <Moon />}
                      </div>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-medium">Select Theme</span>
                      </div>
                      <ChevronsUpDown className="ml-auto" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setTheme("light")}>
                      <Sun /> Light
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")}>
                      <Moon /> Dark
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  )
}
