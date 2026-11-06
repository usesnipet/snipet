import logo from "@/assets/logo.svg";
import { Link } from "@/components/ui/link";
import { SidebarHeader } from "@/components/ui/sidebar";

/** The product mark at the top of a sidebar; extra header content goes in children. */
export function SidebarBrand({ children }: { children?: React.ReactNode }) {
  return (
    <SidebarHeader className="gap-3 px-3 py-4">
      <Link
        href="/"
        className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
      >
        <img src={logo} alt="Snipet" className="size-7" />
        <span className="text-[15px] font-semibold group-data-[collapsible=icon]:hidden">Snipet</span>
      </Link>
      {children}
    </SidebarHeader>
  );
}
