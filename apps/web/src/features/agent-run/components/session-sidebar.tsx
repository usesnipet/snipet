import { DeleteDialog } from "@/components/confirm-dialog";
import { SidebarBrand } from "@/components/sidebar/brand";
import { SidebarFooter } from "@/components/sidebar/footer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/components/ui/link";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AgentAvatar } from "@/features/agent/components/agent-avatar";
import { useCurrentUser } from "@/features/auth/hooks";
import { useDialog } from "@/lib/dialog";
import { ROUTES } from "@/routes";
import { useDeleteSession, useListAvailableAgents, useListSessions } from "@snipet/client";
import { hasRole, Role } from "@snipet/shared";
import { transitions } from "@/lib/motion";
import { MoreHorizontal, Settings, SquarePen, Trash2 } from "lucide-react";
import moment from "moment";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate, useSearchParams } from "react-router";

import { agentChatPath } from "@/features/agent/lib/agent-path";

import { sessionPath } from "../lib/session-path";

import { AgentFilterBar } from "./agent-filter-bar";

import type { AgentSession } from "@snipet/shared";
type Props = {
  activeSessionId?: string;
  /** Session whose run is streaming right now. */
  runningSessionId?: string;
};

type SessionGroup = { label: string; sessions: AgentSession[] };

/** A sidebar row that can fade in, fade out and slide to its new place when the list reorders. */
const MotionMenuItem = motion.create(SidebarMenuItem);

/** Buckets sessions (already newest first) into Today, Yesterday, Previous 7 days and Older; empty groups are dropped. */
function groupByDate(sessions: AgentSession[]): SessionGroup[] {
  const today = moment().startOf("day");
  const yesterday = today.clone().subtract(1, "day");
  const lastWeek = today.clone().subtract(7, "days");
  const groups: SessionGroup[] = [
    { label: "Today", sessions: [] },
    { label: "Yesterday", sessions: [] },
    { label: "Previous 7 days", sessions: [] },
    { label: "Older", sessions: [] },
  ];
  for (const session of sessions) {
    const at = moment(session.updatedAt);
    const index = at.isSameOrAfter(today) ? 0 : at.isSameOrAfter(yesterday) ? 1 : at.isSameOrAfter(lastWeek) ? 2 : 3;
    groups[index].sessions.push(session);
  }
  return groups.filter((group) => group.sessions.length > 0);
}

export function SessionSidebar({ activeSessionId, runningSessionId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const agentParam = searchParams.get("agent");
  const { data: agents } = useListAvailableAgents();
  const agentOf = new Map(agents?.map((agent) => [agent.id, agent]));
  // Only an agent from the list: a link can name a disabled or deleted one, or not even an id.
  const activeAgent = agentParam ? agentOf.get(agentParam) : undefined;
  const { data: sessionsPage, isLoading, isError } = useListSessions(activeAgent?.id);
  // Until the agents arrive the param can't be checked, and showing every chat would flash the wrong list.
  const isAwaitingFilter = !!agentParam && !agents;
  const data = isAwaitingFilter ? undefined : sessionsPage;
  const newChatPath = activeAgent ? agentChatPath(activeAgent.id) : ROUTES.chat;
  const user = useCurrentUser();
  const isAdmin = hasRole(user?.role, [Role.Admin]);
  const { openDialog } = useDialog();
  const navigate = useNavigate();
  const { mutateAsync: deleteSession } = useDeleteSession();

  const toggleFilter = (agentId: string) =>
    setSearchParams(agentId === activeAgent?.id ? {} : { agent: agentId }, { replace: true });

  const openDelete = (session: AgentSession) => {
    openDialog({
      component: DeleteDialog,
      props: {
        title: "Delete chat?",
        description: (
          <>
            This will permanently delete{" "}
            <span className="font-medium text-foreground">{session.title || "this chat"}</span> and all its messages.
            This action cannot be undone.
          </>
        ),
        onConfirm: async () => {
          await deleteSession(session.id);
          if (session.id === activeSessionId) navigate(newChatPath);
        },
      },
    });
  };

  return (
    <Sidebar>
      <SidebarBrand>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href={newChatPath}>
                <SquarePen />
                New chat
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <AgentFilterBar agents={agents ?? []} activeAgentId={activeAgent?.id} onToggle={toggleFilter} />
      </SidebarBrand>

      <SidebarContent>
        {(isLoading || isAwaitingFilter) && (
          <SidebarGroup>
            <SidebarMenu>
              {Array.from({ length: 6 }, (_, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuSkeleton />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
        {isError && <p className="text-destructive px-4 text-xs">Failed to load chats.</p>}
        {data && data.data.length === 0 && (
          <p className="text-muted-foreground px-4 text-xs">
            {activeAgent ? (
              <>
                No chats with {activeAgent.name} yet.{" "}
                <Link href={newChatPath} className="text-sidebar-foreground underline">
                  Start a chat
                </Link>
              </>
            ) : (
              "No chats yet. Start one to see it here."
            )}
          </p>
        )}
        {data &&
          groupByDate(data.data).map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* Rows on screen at mount stay still; a new chat fades in at the top and the rest slide down. */}
                  <AnimatePresence initial={false} mode="popLayout">
                    {group.sessions.map((session) => (
                      <MotionMenuItem
                        key={session.id}
                        layout="position"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: transitions.fast }}
                        transition={transitions.base}
                      >
                        <SidebarMenuButton asChild isActive={session.id === activeSessionId}>
                          <Link href={sessionPath(session.id, activeAgent?.id)} title={session.title || undefined}>
                            <AgentAvatar
                              avatar={agentOf.get(session.agentId)?.avatar}
                              name={agentOf.get(session.agentId)?.name}
                              className="size-5 shrink-0"
                            />
                            <span className="truncate">{session.title || "Untitled chat"}</span>
                            {session.id === runningSessionId && <Spinner size="sm" className="ml-auto" />}
                          </Link>
                        </SidebarMenuButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuAction showOnHover aria-label="Chat options">
                              <MoreHorizontal />
                            </SidebarMenuAction>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => openDelete(session)}
                            >
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </MotionMenuItem>
                    ))}
                  </AnimatePresence>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
      </SidebarContent>

      <SidebarFooter
        systemAction={
          isAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Manage agents" asChild>
                  <Link
                    className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
                    href={ROUTES.agents}
                  >
                    <Settings />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Manage agents</TooltipContent>
            </Tooltip>
          )
        }
      />
    </Sidebar>
  );
}
