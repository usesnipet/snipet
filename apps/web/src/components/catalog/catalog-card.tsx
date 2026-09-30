import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { SVG } from "@/components/ui/svg";
import { cn } from "@/lib/utils";
import { useCallback } from "react";

import { formatUpdatedAt } from "./format-updated-at";
import { truncateDescription } from "./truncate-description";

export type CatalogCardAction = {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
};

export type CatalogCardCta = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  variant?: "default" | "outline" | "secondary";
};

export type CatalogCardProps = {
  icon?: string | React.ReactNode;
  badge?: string;
  title: string;
  updatedAt?: string;
  description?: string;
  /** Small outline badges rendered after the title (e.g. capability tags). */
  tags?: string[];
  /** Muted text on the left of the footer (e.g. a related-item count). */
  meta?: React.ReactNode;
  /** Primary call-to-action rendered on the right of the footer. */
  cta?: CatalogCardCta;
  extraBadges?: React.ReactNode;
  headerActions?: React.ReactNode;
  onClick?: () => void;
  actions?: CatalogCardAction[];
  className?: string;
};

export function CatalogCard({
  icon,
  badge,
  title,
  updatedAt,
  actions,
  headerActions,
  description,
  tags,
  meta,
  cta,
  extraBadges,
  onClick,
  className,
}: CatalogCardProps) {
  const renderIcon = useCallback(() => {
    if (!icon) return null;
    if (typeof icon === "string") return <SVG svg={icon} className="size-6" />;
    return icon;
  }, [icon]);

  const hasFooter = Boolean(meta || cta);

  return (
    <Card
      className={cn(
        "flex h-full flex-col gap-0 p-5",
        onClick && "cursor-pointer transition-colors hover:border-primary/40",
        className,
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-start gap-3 space-y-0 p-0 pb-3">
        {renderIcon()}
        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <h2 className="truncate text-sm font-semibold leading-tight">{title}</h2>
            {badge ? (
              <Badge variant="secondary" className="shrink-0 font-normal">
                {badge}
              </Badge>
            ) : null}
            {tags?.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-muted-foreground shrink-0 font-normal"
              >
                {tag}
              </Badge>
            ))}
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
      <CardContent className="flex flex-1 flex-col gap-3 p-0">
        {description ? (
          <p className="text-muted-foreground text-sm">{truncateDescription(description)}</p>
        ) : null}
        {updatedAt ? (
          <p className="text-muted-foreground mt-auto pt-1 text-xs">
            Updated {formatUpdatedAt(updatedAt)}
          </p>
        ) : null}
      </CardContent>
      {hasFooter ? (
        <CardFooter
          className="mt-4 flex items-center justify-between gap-3 p-0"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="text-muted-foreground min-w-0 truncate text-xs">{meta}</span>
          {cta ? (
            <Button
              variant={cta.variant ?? "outline"}
              size="sm"
              disabled={cta.disabled}
              onClick={cta.onClick}
            >
              {cta.icon}
              {cta.label}
            </Button>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}
