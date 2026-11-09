import { SidebarBrand } from "@/components/sidebar/brand";
import { SidebarNav } from "@/components/sidebar/nav";
import { Sidebar as SidebarContainer } from "@/components/ui/sidebar";
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
      { title: "LLMs", href: ROUTES.llmConnections, icon: Server, visible: isAdmin },
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
        title: "API keys",
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
      <SidebarBrand />
      <SidebarNav navItems={navItems} />
      {/* <UserMenu /> */}
      <SidebarFooter />
    </SidebarContainer>
  );
}
