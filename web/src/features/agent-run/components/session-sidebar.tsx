import { DeleteDialog } from "@/components/confirm-dialog";
import { Link } from "@/components/ui/link";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuAction, SidebarMenuButton, SidebarMenuItem, SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useDialog } from "@/lib/dialog";
import { ROUTES } from "@/routes";
import { ArrowLeft, MoreHorizontal, SquarePen, Trash2 } from "lucide-react";
import moment from "moment";
import { useNavigate } from "react-router";

import { useDeleteSession, useListSessions } from "../hooks";
import { sessionPath } from "../lib/session-path";

import type { AgentSession } from "../schemas";

type Props = {
  activeSessionId?: string;
  /** Session whose run is streaming right now. */
  runningSessionId?: string;
};

type SessionGroup = { label: string; sessions: AgentSession[] };

// groupByDate buckets sessions (already newest first) by last activity.
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
    const at = moment(session.updated_at);
    const index = at.isSameOrAfter(today) ? 0 : at.isSameOrAfter(yesterday) ? 1 : at.isSameOrAfter(lastWeek) ? 2 : 3;
    groups[index].sessions.push(session);
  }
  return groups.filter((group) => group.sessions.length > 0);
}

export function SessionSidebar({ activeSessionId, runningSessionId }: Props) {
  const { data, isLoading, isError } = useListSessions();
  const { openDialog } = useDialog();
  const navigate = useNavigate();
  const { mutateAsync: deleteSession } = useDeleteSession();

  const openDelete = (session: AgentSession) => {
    openDialog({
      component: DeleteDialog,
      props: {
        title: "Delete chat?",
        description: (
          <>
            This will permanently delete{" "}
            <span className="font-medium text-foreground">{session.title || "this chat"}</span>{" "}
            and all its messages. This action cannot be undone.
          </>
        ),
        onConfirm: async () => {
          await deleteSession(session.id);
          if (session.id === activeSessionId) navigate(ROUTES.agentPlayground);
        },
      },
    });
  };

  return (
    <Sidebar>
      <SidebarHeader className="gap-1 px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href={ROUTES.agentPlayground}>
                <SquarePen />
                New chat
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {isLoading && (
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
          <p className="text-muted-foreground px-4 text-xs">No chats yet. Start one to see it here.</p>
        )}
        {data &&
          groupByDate(data.data).map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.sessions.map((session) => (
                    <SidebarMenuItem key={session.id}>
                      <SidebarMenuButton asChild isActive={session.id === activeSessionId}>
                        <Link href={sessionPath(session.id)}>
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
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => openDelete(session)}>
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href={ROUTES.home}>
                <ArrowLeft />
                Back to Snipet
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
