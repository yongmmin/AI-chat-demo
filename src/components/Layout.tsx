import type { ReactNode } from "react";

interface LayoutProps {
  sidebar?: ReactNode;
  sidebarOpen?: boolean;
  children: ReactNode;
}

export default function Layout({
  sidebar,
  sidebarOpen = true,
  children,
}: LayoutProps) {
  return (
    <div className="layout">
      {sidebar && (
        <div className={`layout-sidebar ${sidebarOpen ? "" : "layout-sidebar-closed"}`}>
          {sidebar}
        </div>
      )}
      <main className="layout-main">{children}</main>
    </div>
  );
}
