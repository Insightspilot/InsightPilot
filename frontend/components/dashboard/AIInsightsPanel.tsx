"use client";

import { useState } from "react";
import { Card, Button, Typography, Space, Tag, Alert, Spin } from "antd";
import {
  BulbOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import {
  generateVisualizationInsightsAction,
  type VisualizationInsightsData,
} from "@/lib/actions";

const { Text, Paragraph } = Typography;

interface AIInsightsPanelProps {
  vizId: string;
  columns: string[];
  rows: unknown[][];
  truncated?: boolean;
  dashboardId?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export default function AIInsightsPanel({
  vizId,
  columns,
  rows,
  truncated = false,
  dashboardId,
  disabled = false,
  disabledReason,
}: AIInsightsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<VisualizationInsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateVisualizationInsightsAction(
        vizId,
        columns,
        rows,
        truncated,
        dashboardId,
      );
      if (result.ok && result.data) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to generate insights");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      size="small"
      bordered
      style={{
        borderColor: "#bfdbfe",
        marginBottom: 16,
        background: "linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)",
      }}
      title={
        <Space>
          <BulbOutlined style={{ color: "#2563EB" }} />
          <Text strong style={{ color: "#1e293b" }}>AI Insights</Text>
          {data && (
            <Tag color={data.source === "gemini" ? "blue" : "default"}>
              {data.source === "gemini" ? (
                <Space size={4}>
                  <RobotOutlined />
                  Powered by Gemini
                </Space>
              ) : (
                "Rule-based"
              )}
            </Tag>
          )}
        </Space>
      }
      extra={
        data && !loading ? (
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={handleGenerate}
          >
            Regenerate
          </Button>
        ) : null
      }
    >
      {!data && !loading && !error && (
        <div style={{ textAlign: "center", padding: "24px 12px" }}>
          <ThunderboltOutlined
            style={{ fontSize: 36, color: "#2563EB", marginBottom: 12 }}
          />
          <Paragraph style={{ color: "#475569", marginBottom: 16 }}>
            Get AI-powered insights about this visualization — trends, outliers,
            and key patterns explained in plain language.
          </Paragraph>
          <Button
            type="primary"
            icon={<BulbOutlined />}
            onClick={handleGenerate}
            disabled={disabled || rows.length === 0}
            style={{
              background: "linear-gradient(135deg, #2563EB, #3b82f6)",
              border: "none",
              borderRadius: 8,
            }}
          >
            Generate Insights
          </Button>
          {disabled && disabledReason && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
              {disabledReason}
            </div>
          )}
          {rows.length === 0 && !disabled && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
              No data available to analyze.
            </div>
          )}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: "32px 12px" }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: "#64748b" }}>
            Analyzing your data...
          </div>
        </div>
      )}

      {error && !loading && (
        <Alert
          type="error"
          message="Failed to generate insights"
          description={error}
          showIcon
          action={
            <Button size="small" onClick={handleGenerate}>
              Retry
            </Button>
          }
        />
      )}

      {data && !loading && (
        <div>
          <ul
            style={{
              paddingLeft: 0,
              margin: 0,
              listStyle: "none",
            }}
          >
            {data.insights.map((insight, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "10px 0",
                  borderBottom:
                    i < data.insights.length - 1 ? "1px solid #dbeafe" : "none",
                }}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #2563EB, #3b82f6)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {i + 1}
                </div>
                <Text style={{ color: "#1e293b", lineHeight: "22px", flex: 1 }}>
                  {insight}
                </Text>
              </li>
            ))}
          </ul>
          {data.source === "templated" && (
            <div
              style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "rgba(255,255,255,0.6)",
                borderRadius: 6,
                fontSize: 11,
                color: "#64748b",
              }}
            >
              These are rule-based insights. Configure a Gemini API key in your
              backend environment for AI-powered analysis.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
