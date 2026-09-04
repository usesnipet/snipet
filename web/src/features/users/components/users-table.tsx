import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateFormat } from "@/components/ui/date";
import { useDialog } from "@/lib/dialog";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { useListUsers } from "../hooks";

import { DeleteUserDialog } from "./delete-user-dialog";
import { UpdateUserDialog } from "./update-user-dialog";

import type { DataTableColumn, DataTablePagination } from "@/components/data-table";
import type { User } from "../schemas";

function useUsersListQuery(pagination: DataTablePagination) {
  return useListUsers({ searchParams: pagination });
}

function RowActions({ user }: { user: User }) {
  const { openDialog } = useDialog();

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Edit user"
        onClick={() => openDialog({ component: UpdateUserDialog, props: { user } })}
      >
        <PencilIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete user"
        onClick={() => openDialog({ component: DeleteUserDialog, props: { user } })}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}

const columns: DataTableColumn<User>[] = [
  { id: "name", header: "Name", cell: (user) => user.name },
  { id: "username", header: "Username", cell: (user) => user.username },
  {
    id: "role",
    header: "Role",
    cell: (user) => (
      <Badge variant={user.role === "admin" ? "default" : "secondary"} className="capitalize">
        {user.role}
      </Badge>
    ),
  },
  {
    id: "created",
    header: "Created",
    cell: (user) => <DateFormat date={user.created_at} />,
  },
  {
    id: "actions",
    header: "",
    headerClassName: "w-0",
    className: "text-right",
    cell: (user) => <RowActions user={user} />,
  },
];

export function UsersTable() {
  return (
    <DataTable
      columns={columns}
      useQuery={useUsersListQuery}
      getRowKey={(user) => user.id}
      emptyMessage="No users yet."
    />
  );
}
