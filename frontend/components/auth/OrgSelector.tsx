"use client";

import { Button, Typography, Space } from "antd";

const { Text } = Typography;

interface Org {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface OrgSelectorProps {
  orgs: Org[];
  loading: boolean;
  onSelect: (orgId: string) => void;
}

export default function OrgSelector({ orgs, loading, onSelect }: OrgSelectorProps) {
  return (
    <div>
      <Text strong style={{ display: "block", marginBottom: 16, fontSize: 16 }}>
        Select an organization
      </Text>
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        {orgs.map((org) => (
          <Button
            key={org.id}
            block
            size="large"
            onClick={() => onSelect(org.id)}
            loading={loading}
            style={{ textAlign: "left", height: "auto", padding: "12px 16px" }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{org.name}</div>
              <div style={{ fontSize: 12, color: "#666" }}>{org.role}</div>
            </div>
          </Button>
        ))}
      </Space>
    </div>
  );
}
