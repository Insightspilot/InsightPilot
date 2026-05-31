"use client";

import { useMemo } from "react";
import { useDebouncedValue } from "@/lib/hooks";
import { Layout, Input, Menu } from "antd";
import type { MenuProps } from "antd";
import {
  SearchOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  FileTextOutlined,
  TeamOutlined,
  SafetyOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
  PieChartOutlined,
} from "@ant-design/icons";

const { Sider } = Layout;

type MenuItem = Required<MenuProps>["items"][number] & {
  label?: string | React.ReactNode;
  children?: MenuItem[];
  searchText?: string;
};

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
  activeKey: string;
  onMenuClick: (key: string) => void;
  isOwner: boolean;
  isOwnerOrAdmin: boolean;
  search: string;
  onSearchChange: (value: string) => void;
}

export default function Sidebar({ collapsed, onCollapse, activeKey, onMenuClick, isOwner, isOwnerOrAdmin, search, onSearchChange }: SidebarProps) {
  const debouncedSearch = useDebouncedValue(search, 300);
  const allMenuItems: MenuItem[] = useMemo(() => [
    {
      key: "grp-analytics",
      label: "Analytics",
      type: "group" as const,
      children: [
        { key: "overview", icon: <DashboardOutlined />, label: "Overview", searchText: "overview dashboard home" },
        ...(isOwnerOrAdmin
          ? [{ key: "data-sources", icon: <DatabaseOutlined />, label: "Data Sources", searchText: "data sources connect database" }]
          : []),
        { key: "dashboards", icon: <BarChartOutlined />, label: "Dashboards", searchText: "dashboards charts reports" },
        ...(isOwnerOrAdmin
          ? [{ key: "queries", icon: <FileTextOutlined />, label: "Queries", searchText: "queries sql run" }]
          : []),
        { key: "visualizations", icon: <PieChartOutlined />, label: "Visualizations", searchText: "visualizations charts saved" },
      ],
    },
    ...(isOwner
      ? [{
          key: "grp-management",
          label: "Management",
          type: "group" as const,
          children: [
            { key: "team", icon: <TeamOutlined />, label: "Team Members", searchText: "team members users invite" },
            { key: "access", icon: <SafetyOutlined />, label: "Access Management", searchText: "access management sharing permissions" },
          ],
        }]
      : [{
          key: "grp-management",
          label: "Management",
          type: "group" as const,
          children: [
            { key: "access", icon: <SafetyOutlined />, label: "Access Management", searchText: "access management sharing permissions" },
          ],
        }]),
    {
      key: "grp-settings",
      label: "Settings",
      type: "group" as const,
      children: [
        { key: "settings", icon: <SettingOutlined />, label: "Settings", searchText: "settings preferences configuration" },
        { key: "help", icon: <QuestionCircleOutlined />, label: "Help & Support", searchText: "help support documentation" },
      ],
    },
  ], [isOwner, isOwnerOrAdmin]);

  const filteredMenuItems = useMemo(() => {
    if (!debouncedSearch.trim()) return allMenuItems;
    const q = debouncedSearch.toLowerCase();
    return allMenuItems
      .map((group) => {
        if (!group || !("children" in group) || !group.children) return null;
        const filtered = group.children.filter((item) => {
          const text = (item as MenuItem)?.searchText || "";
          const label = typeof (item as MenuItem)?.label === "string" ? ((item as MenuItem).label as string) : "";
          return text.toLowerCase().includes(q) || label.toLowerCase().includes(q);
        });
        if (filtered.length === 0) return null;
        return { ...group, children: filtered };
      })
      .filter(Boolean) as MenuItem[];
  }, [debouncedSearch, allMenuItems]);

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      trigger={null}
      width={240}
      collapsedWidth={0}
      style={{
        background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
        borderRight: "none",
        position: "sticky",
        top: 60,
        height: "calc(100vh - 60px)",
        overflow: "auto",
      }}
      breakpoint="md"
      onBreakpoint={(broken) => onCollapse(broken)}
    >
      {!collapsed && (
        <div style={{ padding: "16px 12px 8px" }}>
          <Input
            className="sidebar-dark-search"
            placeholder="Search..."
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            allowClear
            size="small"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.1)",
              borderColor: "rgba(255, 255, 255, 0.15)",
              color: "#e2e8f0",
            }}
          />
        </div>
      )}
      <Menu
        className="sidebar-dark-menu"
        mode="inline"
        selectedKeys={[activeKey]}
        onClick={({ key }) => { onMenuClick(key); onSearchChange(""); }}
        style={{ border: "none", marginTop: 4, background: "transparent" }}
        items={filteredMenuItems}
      />
    </Sider>
  );
}
