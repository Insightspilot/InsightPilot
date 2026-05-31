"use client";

import { useEffect, useState, useRef } from "react";
import { Spin, Empty, Typography, Input } from "antd";
import type { InputRef } from "antd";
import { CloseOutlined, DragOutlined, EditOutlined } from "@ant-design/icons";
import { executeQueryAction, getVisualizationAction } from "@/lib/actions";
import type { VisualizationDetail } from "@/lib/actions";
import { useActivityTracker } from "@/components/providers/useActivityTracker";
import ChartRenderer from "./ChartRenderer";

const { Text } = Typography;

interface DashboardWidgetProps {
  vizId: string;
  editing?: boolean;
  label?: string;
  dashboardId?: string;
  onLabelChange?: (label: string) => void;
  onRemove?: () => void;
}

export default function DashboardWidget({ vizId, editing, label, dashboardId, onLabelChange, onRemove }: DashboardWidgetProps) {
  const { track } = useActivityTracker();
  const [viz, setViz] = useState<VisualizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getVisualizationAction(vizId, dashboardId).then(async (res) => {
      if (cancelled) return;
      if (!res.ok || !res.data) {
        setError(res.error || "Failed to load visualization");
        setLoading(false);
        return;
      }
      setViz(res.data);
      track("visualization.viewed", {
        resourceType: "visualization",
        resourceId: vizId,
        metadata: { title: res.data.title, chart_type: res.data.chart_type, dashboard_id: dashboardId },
      });
      const qr = await executeQueryAction(res.data.ds_id, res.data.sql_query, 1000);
      if (cancelled) return;
      if (qr.ok && qr.data) {
        setColumns(qr.data.columns);
        setRows(qr.data.rows);
      } else {
        setError(qr.error || "Query failed");
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [vizId, dashboardId]);

  if (loading) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="small" />
      </div>
    );
  }

  if (error || !viz) {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
        <Empty description={error || "Not found"} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  const config = viz.chart_config as { xAxis?: string; yAxis?: string[] };
  const xAxis = config.xAxis || columns[0] || "";
  const yAxis = config.yAxis || (columns.length > 1 ? [columns[1]] : []);

  const displayTitle = label || viz.title;

  const startEditTitle = () => {
    if (!editing || !onLabelChange) return;
    setTitleDraft(displayTitle);
    setEditingTitle(true);
    setTimeout(() => inputRef.current?.focus({ cursor: "end" }), 50);
  };

  const commitTitle = () => {
    setEditingTitle(false);
    const trimmed = titleDraft.trim();
    // If cleared or same as original viz title, reset to undefined (use viz title)
    if (!trimmed || trimmed === viz.title) {
      onLabelChange?.("");
    } else {
      onLabelChange?.(trimmed);
    }
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div
        className={editing ? "drag-handle" : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 10px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
          minHeight: 32,
          gap: 6,
          cursor: editing ? "grab" : "default",
        }}
      >
        {editing && (
          <DragOutlined
            style={{ color: "#94a3b8", fontSize: 12 }}
          />
        )}
        {editingTitle ? (
          <Input
            ref={inputRef}
            size="small"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onPressEnter={commitTitle}
            style={{ fontSize: 13, flex: 1 }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
        ) : (
          <Text
            strong
            style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: editing ? "text" : "default" }}
            onDoubleClick={startEditTitle}
          >
            {displayTitle}
            {editing && onLabelChange && (
              <EditOutlined
                style={{ marginLeft: 6, fontSize: 11, color: "#94a3b8", cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); startEditTitle(); }}
              />
            )}
          </Text>
        )}
        {editing && onRemove && (
          <CloseOutlined
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{ cursor: "pointer", color: "#94a3b8", fontSize: 11 }}
          />
        )}
      </div>
      {/* Chart area */}
      <div style={{ flex: 1, padding: "4px 6px 6px", minHeight: 0, overflow: "hidden", pointerEvents: editing ? "none" : "auto" }}>
        <ChartRenderer
          chartType={viz.chart_type}
          columns={columns}
          rows={rows}
          xAxis={xAxis}
          yAxis={yAxis}
          mode="compact"
          instanceId={vizId}
        />
      </div>
    </div>
  );
}
