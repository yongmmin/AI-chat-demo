import { useState } from "react";
import { Outlet, Route, Routes as ReactRoutes, useNavigate } from "react-router";
import { useSessions } from "../hooks/useSessions";
import Layout from "../components/Layout";
import Sidebar from "../components/Sidebar";
import ChatHomePage from "./ChatHomePage";
import ChatSessionPage from "./ChatSessionPage";
import ChatHistoryPage from "./ChatHistoryPage";

export interface SidebarOutletContext {
  refetchSessions: () => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

function SidebarLayout() {
  const navigate = useNavigate();
  const { sessions, refetch } = useSessions();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  const context: SidebarOutletContext = {
    refetchSessions: refetch,
    sidebarOpen,
    toggleSidebar,
  };

  return (
    <Layout
      sidebar={
        <Sidebar
          sessions={sessions}
          onNewChat={() => navigate("/")}
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
        />
      }
      sidebarOpen={sidebarOpen}
    >
      <Outlet context={context} />
    </Layout>
  );
}

export function Routes() {
  return (
    <ReactRoutes>
      <Route element={<SidebarLayout />}>
        <Route path="/" element={<ChatHomePage />} />
        <Route path="/chat/:id" element={<ChatSessionPage />} />
      </Route>
      <Route path="/history" element={<ChatHistoryPage />} />
    </ReactRoutes>
  );
}
