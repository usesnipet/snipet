import { SidebarContent } from "@/components/sidebar/content";
import { Link } from "@/components/ui/link";
import { Sidebar as SidebarContainer, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { ToggleTheme } from "@/components/ui/toggle-theme";
import { ROUTES } from "@/routes";
import { BookText, Home, MessageSquare, Server, Settings, Waypoints } from "lucide-react";

import type { NavEntry } from "@/components/sidebar/types";
import { Version } from "./version";

const navItems: NavEntry[] = [
  {
    label: "Workspace",
    items: [
      { title: "Home", href: ROUTES.home, icon: Home, exact: true },
      { title: "Agents", href: ROUTES.agents, icon: MessageSquare, comingSoon: true },
      { title: "LLM Connections", href: ROUTES.llmConnections, icon: Server },
      { title: "Knowledge", href: ROUTES.knowledge, icon: BookText, comingSoon: true },
      { title: "Connections", href: ROUTES.connections, icon: Waypoints, comingSoon: true },
    ],
  },
  {
    label: "Configure",
    items: [{ title: "Settings", href: ROUTES.settings, icon: Settings }],
  },
];

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.32.47-2.39 1.24-3.23-.12-.31-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.18.77.84 1.23 1.91 1.23 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.82 1.1.82 2.22 0 1.6-.02 2.89-.02 3.28 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}

function SidebarFooterInfo() {

  return (
    <SidebarFooter className="flex-row items-center justify-between border-sidebar-border border-t group-data-[collapsible=icon]:hidden">
      <Version />
      <div className="flex items-center gap-0.5">
        <ToggleTheme />
        <a
          href="https://github.com/usesnipet/snipet"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub repository"
          className="text-sidebar-foreground/50 hover:text-sidebar-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors"
        >
          <GithubIcon className="size-4" />
        </a>
      </div>
    </SidebarFooter>
  );
}

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
      <SidebarContent navItems={navItems} />
      <SidebarFooterInfo />
    </SidebarContainer>
  );
}
