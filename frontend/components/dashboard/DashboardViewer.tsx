"use client";

import { useState, useMemo, useEffect } from "react";
import { Button, Typography, Tag, Space, Breadcrumb, Descriptions } from "antd";
import {
  ArrowLeftOutlined,
  LockOutlined,
  GlobalOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import { ResponsiveGridLayout, type Layout, useContainerWidth, verticalCompactor } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import DashboardWidget from "./DashboardWidget";
import DashboardTextWidget from "./DashboardTextWidget";
import { useActivityTracker } from "@/components/providers/useActivityTracker";
import type { DashboardDetail } from "@/lib/actions";
import type { DashboardLayoutData, DashboardTab } from "./DashboardBuilder";

const { Text, Title } = Typography;

const GRID_COLS = 24;
const ROW_HEIGHT = 40;

interface DashboardViewerProps {
  dashboard: DashboardDetail;
  onBack: () => void;
}

export default function DashboardViewer({ dashboard, onBack }: DashboardViewerProps) {
  const { track } = useActivityTracker();
  const raw = dashboard.layout as unknown as DashboardLayoutData | undefined;
  const tabs: DashboardTab[] = raw?.tabs?.length ? raw.tabs : [{ id: "default", name: "Tab 1", widgets: [] }];
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id || "");
  const { width: containerWidth, containerRef } = useContainerWidth({ initialWidth: 1200 });

  // Track dashboard view
  useEffect(() => {
    track("dashboard.viewed", {
      resourceType: "dashboard",
      resourceId: dashboard.id,
      metadata: { title: dashboard.title },
    });
  }, [dashboard.id, dashboard.title, track]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  const gridLayout: Layout = activeTab.widgets.map((w) => ({
    i: w.i,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} />
        <div style={{ flex: 1 }}>
          <Breadcrumb
            style={{ fontSize: 12, marginBottom: 2 }}
            items={[{ title: "Dashboards" }, { title: dashboard.title }]}
          />
          <Title level={4} style={{ margin: 0 }}>
            {dashboard.title}
          </Title>
        </div>
        <Space>
          {dashboard.visibility === "public" ? (
            <Tag color="green" icon={<GlobalOutlined />}>Public</Tag>
          ) : (
            <Tag icon={<LockOutlined />}>Private</Tag>
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            by {dashboard.creator_name}
          </Text>
        </Space>
      </div>

      {dashboard.description && (
        <Text type="secondary" style={{ marginBottom: 12, display: "block" }}>
          {dashboard.description}
        </Text>
      )}

      {/* Tabs bar */}
      {tabs.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: 4,
            borderBottom: "2px solid #f0f0f0",
            marginBottom: 12,
            overflowX: "auto",
          }}
        >
          {tabs.map((tab) => (
            <div
              key={tab.id}
              style={{
                padding: "6px 14px",
                cursor: "pointer",
                borderBottom: activeTabId === tab.id ? "2px solid #4F6CF7" : "2px solid transparent",
                marginBottom: -2,
                color: activeTabId === tab.id ? "#4F6CF7" : "#666",
                fontWeight: activeTabId === tab.id ? 600 : 400,
                fontSize: 13,
                transition: "all 0.2s",
                whiteSpace: "nowrap",
                userSelect: "none",
              }}
              onClick={() => setActiveTabId(tab.id)}
            >
              {tab.name}
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          background: "#fafbfc",
          borderRadius: 8,
          padding: "8px 0",
          minHeight: 400,
        }}
      >
        {activeTab.widgets.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#999" }}>
            <AppstoreOutlined style={{ fontSize: 40, marginRight: 12, color: "#d9d9d9" }} />
            <Text type="secondary">This tab has no widgets</Text>
          </div>
        ) : (
          <div ref={containerRef}>
            <ResponsiveGridLayout
              className="layout"
              width={containerWidth}
              layouts={{ lg: gridLayout }}
              breakpoints={{ lg: 1200, md: 996, sm: 768 }}
              cols={{ lg: GRID_COLS, md: 18, sm: 12 }}
              rowHeight={ROW_HEIGHT}
              dragConfig={{ enabled: false }}
              resizeConfig={{ enabled: false }}
              compactor={verticalCompactor}
              margin={[12, 12]}
              containerPadding={[12, 12]}
            >
              {activeTab.widgets.map((w) => (
                <div
                  key={w.i}
                  style={{
                    background: "#fff",
                    borderRadius: 8,
                    border: "1px solid #e8e8e8",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                    overflow: "hidden",
                  }}
                >
                  {w.type === "heading" || w.type === "text" ? (
                    <DashboardTextWidget
                      type={w.type}
                      content={w.content || ""}
                    />
                  ) : (
                    <DashboardWidget vizId={w.vizId!} label={w.label} dashboardId={dashboard.id} />
                  )}
                </div>
              ))}
            </ResponsiveGridLayout>
          </div>
        )}
      </div>

      {/* Shared with */}
      {dashboard.shared_with.length > 0 && (
        <div style={{ marginTop: 16, padding: "8px 0" }}>
          <Text strong style={{ fontSize: 13, marginBottom: 8, display: "block" }}>Shared With</Text>
          <Descriptions column={2} size="small">
            {dashboard.shared_with.map((s) => (
              <Descriptions.Item key={s.id} label={s.user_name}>
                {s.user_email}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </div>
      )}
    </div>
  );
}
