import { SidebarContent } from "@/components/sidebar/content";
import { Link } from "@/components/ui/link";
import { Sidebar, SidebarHeader } from "@/components/ui/sidebar";
import { ToggleTheme } from "@/components/ui/toggle-theme";
import { ROUTES } from "@/routes";
import { Home } from "lucide-react";

import type { NavEntry } from "@/components/sidebar/types";

const navItems: NavEntry[] = [
  {
    title: "Home",
    href: ROUTES.home,
    icon: Home,
    exact: true,
  },
];

export function AdminSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="flex flex-row items-center justify-between">
        <Link href="/" className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <img src="/favicon.svg" alt="snipet" className="size-7 shrink-0" />
          <p className="text-sm font-semibold group-data-[collapsible=icon]:hidden">snipet</p>
        </Link>
        <ToggleTheme />
      </SidebarHeader>
      <SidebarContent navItems={navItems} />
    </Sidebar>
  )
}
