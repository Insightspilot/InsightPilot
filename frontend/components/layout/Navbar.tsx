"use client";

import { Layout, Typography, Button, Dropdown, Avatar, Space } from "antd";
import { UserOutlined, LogoutOutlined, SettingOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { UserProfile } from "@/lib/auth";

const { Header } = Layout;
const { Text } = Typography;

interface NavbarProps {
  user: UserProfile;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
  onNavigate?: (key: string) => void;
}

export default function Navbar({ user, collapsed, onToggleCollapse, onLogout, onNavigate }: NavbarProps) {
  const initials = user.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  return (
    <Header
      style={{
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px 0 0",
        height: 60,
        position: "sticky",
        top: 0,
        zIndex: 10,
        borderBottom: "1px solid rgba(226, 232, 240, 0.6)",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03), 0 1px 2px rgba(15, 23, 42, 0.02)",
      }}
    >
      {/* Left: toggle + brand */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggleCollapse}
          style={{ color: "#475569", fontSize: 17, width: 52, height: 60, borderRadius: 0 }}
        />
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 4, cursor: "pointer" }}
          onClick={() => onNavigate?.("overview")}
        >
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #60a5fa 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
          }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "-0.02em" }}>I</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <Text strong style={{ color: "#0f172a", fontSize: 15, letterSpacing: "-0.01em" }}>
              InsightPilot
            </Text>
            <Text style={{ color: "#94a3b8", fontSize: 10, marginTop: 1 }}>Analytics Platform</Text>
          </div>
        </div>
      </div>

      {/* Right: actions + profile */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>

        <Dropdown
          menu={{
            items: [
              {
                key: "profile",
                label: (
                  <div style={{ padding: "4px 0" }}>
                    <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 13 }}>{user.full_name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{user.email}</div>
                  </div>
                ),
                disabled: true,
              },
              { type: "divider" },
              { key: "settings", icon: <SettingOutlined />, label: "Settings", onClick: () => onNavigate?.("settings") },
              { key: "logout", icon: <LogoutOutlined />, label: "Sign Out", danger: true, onClick: onLogout },
            ],
          }}
          placement="bottomRight"
          trigger={["click"]}
        >
          <Button
            type="text"
            style={{
              height: 42,
              borderRadius: 12,
              padding: "0 12px 0 6px",
              display: "flex",
              alignItems: "center",
              transition: "background 0.2s",
            }}
          >
            <Space size={8}>
              <Avatar
                size={32}
                style={{
                  background: "linear-gradient(135deg, #2563EB 0%, #60a5fa 100%)",
                  fontSize: 13,
                  fontWeight: 600,
                  boxShadow: "0 1px 4px rgba(37, 99, 235, 0.25)",
                }}
              >
                {initials}
              </Avatar>
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1, textAlign: "left" }}>
                <span style={{ color: "#1e293b", fontWeight: 600, fontSize: 13 }}>{user.full_name}</span>
                <span style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{user.role || "Member"}</span>
              </div>
            </Space>
          </Button>
        </Dropdown>
      </div>
    </Header>
  );
}
