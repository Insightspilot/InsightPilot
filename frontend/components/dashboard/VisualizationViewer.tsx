"use client";

import { useState, useEffect } from "react";
import {
  Card,
  Button,
  Typography,
  Space,
  Tag,
  Breadcrumb,
  Descriptions,
  Empty,
  Spin,
  App,
} from "antd";
import {
  ArrowLeftOutlined,
  BarChartOutlined,
  LockOutlined,
  GlobalOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import type { VisualizationDetail } from "@/lib/actions";
import { executeQueryAction } from "@/lib/actions";
import ChartRenderer from "./ChartRenderer";
import AIInsightsPanel from "./AIInsightsPanel";

const { Text, Title } = Typography;

interface VisualizationViewerProps {
  viz: VisualizationDetail;
  onBack: () => void;
}

export default function VisualizationViewer({
  viz,
  onBack,
}: VisualizationViewerProps) {
  const { message } = App.useApp();
  const chartConfig = viz.chart_config as { xAxis?: string; yAxis?: string[]; xAxisLabel?: string; yAxisLabel?: string };

  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    executeQueryAction(viz.ds_id, viz.sql_query, 1000).then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        setColumns(result.data.columns);
        setRows(result.data.rows);
        setRowCount(result.data.row_count);
      } else {
        setError(result.error || "Failed to execute query");
        message.error(result.error || "Failed to execute query");
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [viz.id, viz.ds_id, viz.sql_query]);

  const xAxis = chartConfig.xAxis || columns[0] || "";
  const yAxis = chartConfig.yAxis || (columns.length > 1 ? [columns[1]] : []);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={{ padding: "4px 8px" }}
        />
        <div style={{ flex: 1 }}>
          <Breadcrumb
            style={{ fontSize: 12, marginBottom: 2 }}
            items={[
              { title: "Visualizations" },
              { title: viz.title },
            ]}
          />
          <Title level={4} style={{ margin: 0 }}>
            {viz.title}
          </Title>
        </div>
        <Space>
          {viz.visibility === "public" ? (
            <Tag color="green" icon={<GlobalOutlined />}>Public</Tag>
          ) : (
            <Tag icon={<LockOutlined />}>Private</Tag>
          )}
          <Tag>{viz.chart_type}</Tag>
        </Space>
      </div>

      {/* Info */}
      {viz.description && (
        <Card size="small" bordered style={{ borderColor: "#e2e8f0", marginBottom: 16 }}>
          <Text>{viz.description}</Text>
        </Card>
      )}

      {/* Chart */}
      <Card
        size="small"
        bordered
        style={{ borderColor: "#e2e8f0", marginBottom: 16 }}
        title={
          <Space>
            <BarChartOutlined />
            <Text strong>Chart</Text>
            <Tag color="blue">{rowCount} rows</Tag>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" tip="Executing query..." /></div>
        ) : error ? (
          <Empty description={error} />
        ) : rows.length === 0 ? (
          <Empty description="No data" />
        ) : (
          <ChartRenderer
            chartType={viz.chart_type}
            columns={columns}
            rows={rows}
            xAxis={xAxis}
            yAxis={yAxis}
            xAxisLabel={chartConfig.xAxisLabel}
            yAxisLabel={chartConfig.yAxisLabel}
            mode="full"
            instanceId="viewer"
          />
        )}
      </Card>

      {/* AI Insights */}
      {/* {!loading && !error && rows.length > 0 && (
        <AIInsightsPanel
          vizId={viz.id}
          columns={columns}
          rows={rows}
        />
      )} */}

      {/* SQL Query used */}
      <Card
        size="small"
        bordered
        style={{ borderColor: "#e2e8f0", marginBottom: 16 }}
        title={
          <Space>
            <CodeOutlined />
            <Text strong>SQL Query</Text>
          </Space>
        }
      >
        <pre
          style={{
            background: "#1e1e1e",
            color: "#d4d4d4",
            padding: 16,
            borderRadius: 6,
            fontSize: 13,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: 0,
          }}
        >
          {viz.sql_query}
        </pre>
      </Card>

      {/* Shared with */}
      {viz.shared_with.length > 0 && (
        <Card
          size="small"
          bordered
          style={{ borderColor: "#e2e8f0" }}
          title={<Text strong>Shared With</Text>}
        >
          <Descriptions column={1} size="small">
            {viz.shared_with.map((s) => (
              <Descriptions.Item key={s.id} label={s.user_name}>
                {s.user_email}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
      )}
    </div>
  );
}
