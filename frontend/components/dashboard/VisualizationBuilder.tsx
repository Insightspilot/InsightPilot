"use client";

import { useState, useMemo } from "react";
import {
  Card,
  Button,
  Select,
  Input,
  Typography,
  Space,
  Tag,
  Radio,
  Divider,
  Modal,
  App,
  Breadcrumb,
  Tooltip,
} from "antd";
import {
  ArrowLeftOutlined,
  SaveOutlined,
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  TableOutlined,
  AreaChartOutlined,
  DotChartOutlined,
  ShareAltOutlined,
  LockOutlined,
  GlobalOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import {
  createVisualizationAction,
  updateVisualizationAction,
  executeQueryAction,
  listMembersAction,
  shareVisualizationAction,
} from "@/lib/actions";
import type { VisualizationDetail } from "@/lib/actions";
import { useActivityTracker } from "@/components/providers/useActivityTracker";
import ChartRenderer from "./ChartRenderer";

const { Text, Title } = Typography;

const CHART_TYPES = [
  { key: "table", label: "Table", icon: <TableOutlined /> },
  { key: "bar", label: "Bar", icon: <BarChartOutlined /> },
  { key: "line", label: "Line", icon: <LineChartOutlined /> },
  { key: "pie", label: "Pie", icon: <PieChartOutlined /> },
  { key: "area", label: "Area", icon: <AreaChartOutlined /> },
  { key: "scatter", label: "Scatter", icon: <DotChartOutlined /> },
];

interface VisualizationBuilderProps {
  dsId: string;
  dsName: string;
  sqlQuery: string;
  columns: string[];
  data: unknown[][];
  onBack: () => void;
  onSaved?: (viz: VisualizationDetail) => void;
  editingViz?: VisualizationDetail;
}

export default function VisualizationBuilder({
  dsId,
  dsName,
  sqlQuery,
  columns,
  data,
  onBack,
  onSaved,
  editingViz,
}: VisualizationBuilderProps) {
  const { message } = App.useApp();
  const { track } = useActivityTracker();
  const isEditing = !!editingViz;
  const editConfig = editingViz?.chart_config as { xAxis?: string; yAxis?: string[]; xAxisLabel?: string; yAxisLabel?: string } | undefined;

  // Chart config state
  const [chartType, setChartType] = useState(editingViz?.chart_type || "bar");
  const [xAxis, setXAxis] = useState<string>(editConfig?.xAxis || columns[0] || "");
  const [yAxis, setYAxis] = useState<string[]>(
    editConfig?.yAxis || (columns.length > 1 ? [columns[1]] : [])
  );
  const [xAxisLabel, setXAxisLabel] = useState<string>(editConfig?.xAxisLabel || columns[0] || "");
  const [yAxisLabel, setYAxisLabel] = useState<string>(
    editConfig?.yAxisLabel || (columns.length > 1 ? columns[1] : "")
  );
  const [title, setTitle] = useState(editingViz?.title || "");
  const [description, setDescription] = useState(editingViz?.description || "");
  const [visibility, setVisibility] = useState<"private" | "public">(editingViz?.visibility || "private");

  // Mutable SQL / data state (for edit mode)
  const [currentSql, setCurrentSql] = useState(sqlQuery);
  const [currentColumns, setCurrentColumns] = useState(columns);
  const [currentData, setCurrentData] = useState(data);
  const [queryRunning, setQueryRunning] = useState(false);

  const handleRunQuery = async () => {
    if (!currentSql.trim()) {
      message.warning("Enter a SQL query");
      return;
    }
    setQueryRunning(true);
    try {
      const result = await executeQueryAction(dsId, currentSql, 1000);
      if (result.ok && result.data) {
        setCurrentColumns(result.data.columns);
        setCurrentData(result.data.rows);
        // Reset axis selections to new columns
        setXAxis(result.data.columns[0] || "");
        setXAxisLabel(result.data.columns[0] || "");
        setYAxis(result.data.columns.length > 1 ? [result.data.columns[1]] : []);
        setYAxisLabel(result.data.columns.length > 1 ? result.data.columns[1] : "");
        message.success(`Query returned ${result.data.row_count} rows`);
      } else {
        message.error(result.error || "Query failed");
      }
    } finally {
      setQueryRunning(false);
    }
  };

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);

  // Share state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [orgMembers, setOrgMembers] = useState<
    { id: string; email: string; full_name: string }[]
  >([]);
  const [selectedShareUsers, setSelectedShareUsers] = useState<string[]>([]);
  const [sharingVizId, setSharingVizId] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  // Detect numeric columns
  const numericColumns = useMemo(() => {
    if (currentData.length === 0) return new Set<string>();
    const numeric = new Set<string>();
    currentColumns.forEach((col, idx) => {
      const hasNumeric = currentData.some((row) => {
        const v = row[idx];
        return v !== null && v !== undefined && !isNaN(Number(v));
      });
      if (hasNumeric) numeric.add(col);
    });
    return numeric;
  }, [currentColumns, currentData]);

  const handleSave = async () => {
    if (!title.trim()) {
      message.warning("Please enter a title");
      return;
    }
    setSaving(true);
    try {
      const chartConfig = { xAxis, yAxis, xAxisLabel, yAxisLabel };
      let result;
      if (isEditing) {
        result = await updateVisualizationAction(editingViz.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          sql_query: currentSql !== sqlQuery ? currentSql : undefined,
          chart_type: chartType,
          chart_config: chartConfig,
          visibility,
        });
      } else {
        result = await createVisualizationAction({
          ds_id: dsId,
          title: title.trim(),
          description: description.trim() || undefined,
          sql_query: currentSql,
          chart_type: chartType,
          chart_config: chartConfig,
          visibility,
        });
      }
      if (result.ok && result.data) {
        message.success(isEditing ? "Visualization updated!" : "Visualization saved!");
        track(isEditing ? "visualization.updated" : "visualization.created", {
          resourceType: "visualization",
          resourceId: result.data.id,
          metadata: { title: title.trim(), chart_type: chartType, ds_id: dsId },
        });
        setSaveModalOpen(false);
        setSharingVizId(result.data.id);
        onSaved?.(result.data);
      } else {
        message.error(result.error || "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOpenShare = async () => {
    if (!sharingVizId) {
      message.info("Save the visualization first before sharing");
      return;
    }
    setShareLoading(true);
    try {
      const result = await listMembersAction();
      if (result.ok && result.data) {
        setOrgMembers(
          result.data.map((m) => ({
            id: m.user_id,
            email: m.email,
            full_name: m.full_name,
          }))
        );
      }
    } finally {
      setShareLoading(false);
    }
    setShareModalOpen(true);
  };

  const handleShare = async () => {
    if (!sharingVizId || selectedShareUsers.length === 0) return;
    setShareLoading(true);
    try {
      const result = await shareVisualizationAction(
        sharingVizId,
        selectedShareUsers
      );
      if (result.ok) {
        message.success("Shared successfully!");
        setShareModalOpen(false);
        setSelectedShareUsers([]);
      } else {
        message.error(result.error || "Failed to share");
      }
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
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
              { title: dsName },
              { title: "Query Results" },
              { title: "Visualize" },
            ]}
          />
          <Title level={4} style={{ margin: 0 }}>
            {isEditing ? "Edit Visualization" : "Create Visualization"}
          </Title>
        </div>
        <Space>
          {sharingVizId && (
            <Button
              icon={<ShareAltOutlined />}
              onClick={handleOpenShare}
            >
              Share
            </Button>
          )}
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => setSaveModalOpen(true)}
          >
            Save
          </Button>
        </Space>
      </div>

      {/* Chart type + config */}
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Left: Config panel */}
        <Card
          size="small"
          bordered
          style={{ borderColor: "#e2e8f0", width: 300, flexShrink: 0 }}
        >
          <Text strong style={{ display: "block", marginBottom: 12 }}>
            Chart Type
          </Text>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {CHART_TYPES.map((ct) => (
              <div
                key={ct.key}
                onClick={() => setChartType(ct.key)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "10px 8px",
                  borderRadius: 6,
                  border: `1px solid ${chartType === ct.key ? "#1677ff" : "#e2e8f0"}`,
                  background: chartType === ct.key ? "#f0f7ff" : "#f8fafc",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontSize: 20,
                }}
              >
                {ct.icon}
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: chartType === ct.key ? 600 : 400,
                  }}
                >
                  {ct.label}
                </Text>
              </div>
            ))}
          </div>

          {chartType !== "table" && (
            <>
              <Divider style={{ margin: "12px 0" }} />
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                X-Axis
              </Text>
              <Select
                style={{ width: "100%", marginBottom: 4 }}
                value={xAxis}
                onChange={(val) => {
                  setXAxis(val);
                  setXAxisLabel(val);
                }}
                options={currentColumns.map((c) => ({ value: c, label: c }))}
                placeholder="Select column..."
              />
              <Input
                size="small"
                addonBefore="Label"
                value={xAxisLabel}
                onChange={(e) => setXAxisLabel(e.target.value)}
                style={{ marginBottom: 16 }}
              />

              <Text strong style={{ display: "block", marginBottom: 8 }}>
                Y-Axis
              </Text>
              <Select
                mode={
                  chartType === "pie" || chartType === "scatter"
                    ? undefined
                    : "multiple"
                }
                style={{ width: "100%", marginBottom: 4 }}
                value={
                  chartType === "pie" || chartType === "scatter"
                    ? yAxis[0]
                    : yAxis
                }
                onChange={(val) => {
                  if (Array.isArray(val)) {
                    setYAxis(val);
                    setYAxisLabel(val.length === 1 ? val[0] : "Value");
                  } else {
                    setYAxis([val]);
                    setYAxisLabel(val);
                  }
                }}
                options={currentColumns
                  .filter((c) => c !== xAxis)
                  .map((c) => ({
                    value: c,
                    label: c,
                    disabled:
                      !numericColumns.has(c) && chartType !== "table",
                  }))}
                placeholder="Select column(s)..."
              />
              <Input
                size="small"
                addonBefore="Label"
                value={yAxisLabel}
                onChange={(e) => setYAxisLabel(e.target.value)}
              />
              {chartType !== "table" && (
                <Text
                  type="secondary"
                  style={{ fontSize: 11, marginTop: 4, display: "block" }}
                >
                  Only numeric columns can be used as values
                </Text>
              )}
            </>
          )}
        </Card>

        {/* Right: Chart preview */}
        <Card
          size="small"
          bordered
          style={{ borderColor: "#e2e8f0", flex: 1, minWidth: 0 }}
          title={
            <Space>
              <BarChartOutlined />
              <Text strong>Preview</Text>
              <Tag>{currentData.length} rows</Tag>
            </Space>
          }
        >
          <ChartRenderer
            chartType={chartType}
            columns={currentColumns}
            rows={currentData}
            xAxis={xAxis}
            yAxis={yAxis}
            xAxisLabel={xAxisLabel}
            yAxisLabel={yAxisLabel}
            mode="full"
            instanceId="builder"
          />
        </Card>
      </div>

      {/* SQL Query Editor */}
      {isEditing && (
        <Card
          size="small"
          bordered
          style={{ borderColor: "#e2e8f0", marginTop: 16 }}
          title={<Text strong>SQL Query</Text>}
        >
          <Input.TextArea
            value={currentSql}
            onChange={(e) => setCurrentSql(e.target.value)}
            rows={4}
            style={{ fontFamily: "monospace", fontSize: 13, marginBottom: 8 }}
          />
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={queryRunning}
            onClick={handleRunQuery}
          >
            Run Query
          </Button>
        </Card>
      )}

      {/* Save Modal */}
      <Modal
        title={isEditing ? "Update Visualization" : "Save Visualization"}
        open={saveModalOpen}
        onCancel={() => setSaveModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={isEditing ? "Update" : "Save"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <Text strong style={{ display: "block", marginBottom: 4 }}>
              Title *
            </Text>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My visualization..."
              maxLength={255}
            />
          </div>
          <div>
            <Text strong style={{ display: "block", marginBottom: 4 }}>
              Description
            </Text>
            <Input.TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
            />
          </div>
          <div>
            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Visibility
            </Text>
            <Radio.Group
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <Radio.Button value="private">
                <Space>
                  <LockOutlined />
                  Private
                </Space>
              </Radio.Button>
              <Radio.Button value="public">
                <Space>
                  <GlobalOutlined />
                  Public
                </Space>
              </Radio.Button>
            </Radio.Group>
            <div style={{ marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {visibility === "private"
                  ? "Only you can see this. You can share with specific users later."
                  : "Everyone in your organization can see this."}
              </Text>
            </div>
          </div>
        </div>
      </Modal>

      {/* Share Modal */}
      <Modal
        title="Share Visualization"
        open={shareModalOpen}
        onCancel={() => setShareModalOpen(false)}
        onOk={handleShare}
        confirmLoading={shareLoading}
        okText="Share"
        okButtonProps={{ disabled: selectedShareUsers.length === 0 }}
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          Share with users in your organization:
        </Text>
        <Select
          mode="multiple"
          style={{ width: "100%" }}
          placeholder="Select users..."
          value={selectedShareUsers}
          onChange={setSelectedShareUsers}
          loading={shareLoading}
          options={orgMembers.map((m) => ({
            value: m.id,
            label: `${m.full_name} (${m.email})`,
          }))}
          optionFilterProp="label"
          showSearch
        />
      </Modal>
    </div>
  );
}
