import { usePathBuilder } from "@/hooks/use-path-builder";
import { cn } from "@/lib/utils";
import * as React from "react";
import { Link as RouterLink } from "react-router";

type Props = React.ComponentProps<"a"> & {
  href: string;
}
const Link = React.forwardRef<HTMLAnchorElement, Props>(
  ({ className, href, ...props }, ref) => {
    const buildPath = usePathBuilder();
    const [path, query] = href.split("?");
    return (
      <RouterLink
        {...props}
        ref={ref}
        className={cn(className)}
        to={{
          pathname: buildPath(path),
          search: query ? `?${query}` : "",
        }}
      />
    )
  }
)
Link.displayName = "Link"

export { Link }
