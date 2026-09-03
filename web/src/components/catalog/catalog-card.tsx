import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SVG } from "@/components/ui/svg";
import { cn } from "@/lib/utils";
import { useCallback } from "react";

import { formatUpdatedAt } from "./format-updated-at";
import { truncateDescription } from "./truncate-description";

export type CatalogCardProps = {
  icon?: string | React.ReactNode;
  badge?: string;
  title: string;
  updatedAt?: string;
  description?: string;
  extraBadges?: React.ReactNode;
  headerActions?: React.ReactNode;
  onClick?: () => void;
  actions?: Array<{
    label: string;
    onClick: () => void;
    icon: React.ReactNode;
    disabled?: boolean;
  }>;
};

export function CatalogCard({
  icon,
  badge,
  title,
  updatedAt,
  actions,
  headerActions,
  description,
  extraBadges,
  onClick,
}: CatalogCardProps) {
  const renderIcon = useCallback(() => {
    if (!icon) return null;
    if (typeof icon === "string") return <SVG svg={icon} className="size-6" />;
    return icon;
  }, [icon]);

  return (
    <Card
      className={cn("flex h-full flex-col", onClick && "cursor-pointer")}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-3">
        {renderIcon()}
        <div className="flex min-w-0 flex-1 items-center justify-between space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold leading-tight">{title}</h2>
            {badge ? (
              <Badge variant="secondary" className="shrink-0 font-normal">
                {badge}
              </Badge>
            ) : null}
            {extraBadges}
          </div>
          <div
            className="flex shrink-0 items-center"
            onClick={(event) => event.stopPropagation()}
          >
            {headerActions}
            {actions?.map((action) => (
              <Button
                key={action.label}
                variant="ghost"
                size="icon"
                aria-label={action.label}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.icon}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 pt-0">
        {description ? (
          <p className="text-sm text-muted-foreground">{truncateDescription(description)}</p>
        ) : null}
        {updatedAt ? (
          <p className="mt-auto text-xs text-muted-foreground">
            Updated {formatUpdatedAt(updatedAt)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
