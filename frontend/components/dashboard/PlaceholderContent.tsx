"use client";

import { Card } from "antd";
import {
  DatabaseOutlined,
  BarChartOutlined,
  FileTextOutlined,
  SafetyOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";

const placeholders: Record<string, { icon: React.ReactNode; text: string }> = {
  "data-sources": { icon: <DatabaseOutlined style={{ fontSize: 48, color: "#ddd", marginBottom: 16 }} />, text: "No data sources connected yet." },
  dashboards: { icon: <BarChartOutlined style={{ fontSize: 48, color: "#ddd", marginBottom: 16 }} />, text: "No dashboards created yet." },
  queries: { icon: <FileTextOutlined style={{ fontSize: 48, color: "#ddd", marginBottom: 16 }} />, text: "No queries yet. Connect a data source first." },
  roles: { icon: <SafetyOutlined style={{ fontSize: 48, color: "#ddd", marginBottom: 16 }} />, text: "Roles & permissions management coming soon." },
  settings: { icon: <SettingOutlined style={{ fontSize: 48, color: "#ddd", marginBottom: 16 }} />, text: "Settings coming soon." },
  help: { icon: <QuestionCircleOutlined style={{ fontSize: 48, color: "#ddd", marginBottom: 16 }} />, text: "Help & support coming soon." },
};

interface PlaceholderContentProps {
  page: string;
}

export default function PlaceholderContent({ page }: PlaceholderContentProps) {
  const config = placeholders[page];
  if (!config) return null;

  return (
    <Card bordered style={{ borderColor: "#e2e8f0" }}>
      <div style={{ padding: "60px 0", textAlign: "center", color: "#999" }}>
        {config.icon}
        <div>{config.text}</div>
      </div>
    </Card>
  );
}
