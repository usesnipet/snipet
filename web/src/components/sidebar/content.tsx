"use client"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "@/components/ui/link";
import {
  SidebarContent as SidebarContentBase, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem
} from "@/components/ui/sidebar";
import { usePathBuilder } from "@/hooks/use-path-builder";
import { resolve } from "@/lib/resolve";
import { ChevronRight } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useLocation } from "react-router";

import { isNavActive, isNavGroup, isNavGroupActive, isNavItemWithChildren } from "./utils";

import type { NavEntry, NavLeafEntry } from "./types";

type Props = {
  navItems: NavEntry[]
}

type NavSection = {
  label?: string
  items: NavLeafEntry[]
}

function ComingSoonBadge() {
  return (
    <span className="ml-2 rounded-md bg-sidebar-foreground/10 px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground/50">
      Coming Soon
    </span>
  )
}

function NavMenuItems({ items, pathname }: { items: NavLeafEntry[]; pathname: string }) {
  const toBoolean = (v?: boolean | (() => boolean), defaultValue = true) => {
    const value = resolve(v);
    return value === undefined ? defaultValue : value;
  }

  return (
    <SidebarMenu>
      {items.map((item) =>
        isNavItemWithChildren(item) ? (
          toBoolean(item.visible) &&
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={isNavGroupActive(pathname, item.items)}
            className="group/collapsible"
            disabled={toBoolean(item.disabled)}
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
                  {item.comingSoon && <ComingSoonBadge />}
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items.map((subItem) => (
                    toBoolean(subItem.visible) &&
                    <SidebarMenuSubItem key={subItem.href}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={isNavActive(pathname, subItem.href, subItem.exact) && toBoolean(subItem.visible)}
                      >
                        <Link href={subItem.href}>
                          <span>{subItem.title}</span>
                          {subItem.comingSoon && <ComingSoonBadge />}
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ) : (
          toBoolean(item.visible) &&
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={isNavActive(pathname, item.href, item.exact) && toBoolean(item.visible)}
              tooltip={item.title}
              className="text-sidebar-foreground/70 relative my-0.5 h-9 gap-3 rounded-lg text-[13px] [&_svg]:size-[18px] [&_svg]:text-sidebar-foreground/55 data-[active=true]:text-sidebar-foreground data-[active=true]:[&_svg]:text-sidebar-foreground data-[active=true]:before:absolute data-[active=true]:before:inset-y-1.5 data-[active=true]:before:-left-2 data-[active=true]:before:w-0.5 data-[active=true]:before:rounded-r-full data-[active=true]:before:bg-sidebar-primary"
            >
              <Link href={item.href}>
                <item.icon />
                <span>{item.title}</span>
                {item.comingSoon && <ComingSoonBadge />}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )
      )}
    </SidebarMenu>
  )
}

export function SidebarContent({ navItems }: Props) {
  const { pathname } = useLocation();
  const buildPath = usePathBuilder();

  const transformLeaf = useCallback((item: NavLeafEntry): NavLeafEntry => {
    if (isNavItemWithChildren(item)) {
      return {
        ...item,
        items: item.items.map(sub => ({
          ...sub,
          href: buildPath(sub.href),
        })),
      }
    }
    return {
      ...item,
      href: buildPath(item.href),
    }
  }, [buildPath])

  const sections = useMemo(() => {
    const result: NavSection[] = [];
    for (const item of navItems) {
      if (isNavGroup(item)) {
        result.push({ label: item.label, items: item.items.map(transformLeaf) });
        continue
      }
      const leaf = transformLeaf(item);
      const last = result.at(-1);
      if (last && last.label === undefined) {
        last.items.push(leaf);
      } else {
        result.push({ items: [leaf] });
      }
    }
    return result;
  }, [navItems, transformLeaf]);

  return (
    <SidebarContentBase>
      {sections.map((section, index) => (
        <SidebarGroup key={section.label ?? `group-${index}`} className="gap-1">
          {section.label && (
            <SidebarGroupLabel className="text-sidebar-foreground/50 px-2 text-[10px] font-medium tracking-[0.1em] uppercase">
              {section.label}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <NavMenuItems items={section.items} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </SidebarContentBase>
  )
}
