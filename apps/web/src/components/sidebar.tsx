import { SidebarNav } from "@/components/sidebar/nav";
import { Link } from "@/components/ui/link";
import { Sidebar as SidebarContainer, SidebarHeader } from "@/components/ui/sidebar";
import { useAuthStore } from "@/features/auth/store";
import { ROUTES } from "@/routes";
import { hasRole, Role } from "@snipet/shared";
import { AppWindow, Bot, Key, MessageSquare, Plug, Server, Settings, Users } from "lucide-react";

import { SidebarFooter } from "./sidebar/footer";

import type { NavEntry } from "@/components/sidebar/types";
const isAdmin = () => hasRole(useAuthStore.getState().user?.role, [Role.Admin]);

const navItems: NavEntry[] = [
  {
    label: "Workspace",
    items: [
      { title: "Chat", href: ROUTES.chat, icon: MessageSquare, exact: true },
      { title: "Agents", href: ROUTES.agents, icon: Bot, visible: isAdmin },
      {
        title: "LLMs",
        icon: Server,
        items: [
          { title: "Connections", href: ROUTES.llmConnections },
          { title: "Playground", href: ROUTES.llmPlayground },
        ],
      },
      { title: "Plugins", href: ROUTES.plugins, icon: Plug, visible: isAdmin },
      { title: "Apps", href: ROUTES.apps, icon: AppWindow, visible: isAdmin },
    ],
  },
  {
    label: "Configure",
    items: [
      {
        title: "Users",
        href: ROUTES.users,
        icon: Users,
        visible: isAdmin,
      },

      {
        title: "Api Key",
        href: ROUTES.apiKey,
        icon: Key,
        visible: isAdmin,
      },
      {
        title: "Settings",
        href: ROUTES.settings,
        icon: Settings,
        visible: isAdmin,
      },
    ],
  },
];

export function Sidebar() {
  return (
    <SidebarContainer>
      <SidebarHeader className="px-3 py-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold">
            Sn
          </span>
          <span className="text-[15px] font-semibold group-data-[collapsible=icon]:hidden">Snipet</span>
        </Link>
      </SidebarHeader>
      <SidebarNav navItems={navItems} />
      {/* <UserMenu /> */}
      <SidebarFooter />
    </SidebarContainer>
  );
}
