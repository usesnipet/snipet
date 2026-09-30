import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "./ui/button";
import { Loading } from "./ui/loading";
import { ScrollArea } from "./ui/scroll-area";

import type { Paginated } from "@/schemas/paginated";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Key, ReactNode } from "react";

export type DataTableColumn<T> = {
  id: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
  headerClassName?: string
}

export type DataTablePagination = {
  skip: number
  take: number
}

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  useQuery: (pagination: DataTablePagination) => UseQueryResult<Paginated<T>, Error>
  pageSize?: number
  getRowKey?: (row: T, index: number) => Key
  emptyMessage?: ReactNode
  className?: string
}

const DEFAULT_PAGE_SIZE = 50

export function DataTable<T>({
  columns,
  useQuery,
  pageSize = DEFAULT_PAGE_SIZE,
  getRowKey,
  emptyMessage = "No results.",
  className,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0)
  const pagination: DataTablePagination = {
    skip: page * pageSize,
    take: pageSize,
  }
  const query = useQuery(pagination)
  const rows = query.data?.data ?? []
  const total = query.data?.total ?? 0
  const loading = query.isLoading || query.isFetching
    // const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1)

    // if (query.data && page > lastPage) {
    //   setPage(lastPage)
    // }

  const from = total === 0 ? 0 : pagination.skip + 1
  const to = Math.min(pagination.skip + rows.length, total)
  const hasPrevious = page > 0
  const hasNext = pagination.skip + pageSize < total
  const showFooter = total > 0

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card",
        className,
      )}
    >
      <ScrollArea className="min-h-0 flex-1 **:data-[slot=table-container]:overflow-visible">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={column.headerClassName}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <Loading />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={getRowKey?.(row, index) ?? index}>
                  {columns.map((column) => (
                    <TableCell key={column.id} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>
      {showFooter ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2">
          <p className="text-xs text-muted-foreground">
            {from}–{to} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasPrevious || loading}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              <ChevronLeftIcon />
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!hasNext || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
