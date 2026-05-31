"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Layout } from "antd";
import { logoutAction } from "@/lib/actions";
import { UserProfile } from "@/lib/auth";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import OverviewContent from "@/components/dashboard/OverviewContent";
import TeamMembers from "@/components/dashboard/TeamMembers";
import PlaceholderContent from "@/components/dashboard/PlaceholderContent";
import DataSourcesContent from "@/components/dashboard/DataSourcesContent";
import QueriesContent from "@/components/dashboard/QueriesContent";
import VisualizationsContent from "@/components/dashboard/VisualizationsContent";
import DashboardsContent from "@/components/dashboard/DashboardsContent";
import AccessManagement from "@/components/dashboard/AccessManagement";
import SettingsContent from "@/components/dashboard/SettingsContent";
import HelpSupportContent from "@/components/dashboard/HelpSupportContent";

const { Content } = Layout;

const PLACEHOLDER_PAGES: string[] = [];

export default function DashboardShell({ user: initialUser }: { user: UserProfile }) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [collapsed, setCollapsed] = useState(false);
  const [activeKey, setActiveKey] = useState("overview");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [memberCount, setMemberCount] = useState(0);

  const isOwner = user.role === "owner";
  const isOwnerOrAdmin = user.role === "owner" || user.role === "admin";

  const handleLogout = async () => {
    await logoutAction();
    router.replace("/login");
  };

  const handleMemberCountChange = useCallback((count: number) => {
    setMemberCount(count);
  }, []);

  const handleProfileUpdate = useCallback((updated: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...updated }));
  }, []);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Navbar
        user={user}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onLogout={handleLogout}
        onNavigate={setActiveKey}
      />
      <Layout>
        <Sidebar
          collapsed={collapsed}
          onCollapse={setCollapsed}
          activeKey={activeKey}
          onMenuClick={setActiveKey}
          isOwner={isOwner}
          isOwnerOrAdmin={isOwnerOrAdmin}
          search={sidebarSearch}
          onSearchChange={setSidebarSearch}
        />
        <Content
          onClick={() => { if (!collapsed) setCollapsed(true); }}
          style={{ padding: 32, background: "#f1f5f9", minHeight: "calc(100vh - 60px)" }}
        >
          {activeKey === "overview" && (
            <OverviewContent
              userName={user.full_name}
              orgName=""
              role={(user.role as "owner" | "admin" | "member") || "member"}
              onNavigate={setActiveKey}
            />
          )}
          {activeKey === "team" && isOwner && (
            <TeamMembers onMemberCountChange={handleMemberCountChange} />
          )}
          {activeKey === "data-sources" && isOwnerOrAdmin && (
            <DataSourcesContent />
          )}
          {activeKey === "queries" && isOwnerOrAdmin && (
            <QueriesContent onNavigate={setActiveKey} />
          )}
          {activeKey === "visualizations" && (
            <VisualizationsContent />
          )}
          {activeKey === "dashboards" && (
            <DashboardsContent />
          )}
          {activeKey === "access" && (
            <AccessManagement isOwnerOrAdmin={isOwnerOrAdmin} />
          )}
          {activeKey === "settings" && (
            <SettingsContent user={user} onProfileUpdate={handleProfileUpdate} />
          )}
          {activeKey === "help" && (
            <HelpSupportContent />
          )}
          {PLACEHOLDER_PAGES.includes(activeKey) && (
            <PlaceholderContent page={activeKey} />
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
