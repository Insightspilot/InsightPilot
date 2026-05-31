"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useDebouncedValue } from "@/lib/hooks";
import { Typography, Empty, Input, Dropdown, Button, Checkbox } from "antd";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, type ColDef, type GridOptions } from "ag-grid-community";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  Brush,
} from "recharts";

const { Text } = Typography;

// â”€â”€ Shared constants â”€â”€

export const CHART_COLORS = [
  "#4F6CF7", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6",
  "#06B6D4", "#EC4899", "#F97316", "#6366F1", "#84CC16",
];

const ANIM_DURATION = 800;
const ANIM_EASING = "ease-in-out" as const;

// â”€â”€ Custom tooltip (shared) â”€â”€

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: unknown }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.96)",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6, color: "#374151" }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: p.color,
              display: "inline-block",
            }}
          />
          <span style={{ color: "#6b7280" }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: "#111827" }}>
            {typeof p.value === "number"
              ? p.value.toLocaleString()
              : String(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

// â”€â”€ Types â”€â”€

export interface ChartRendererProps {
  /** Chart type */
  chartType: string;
  /** Columns from query result */
  columns: string[];
  /** Raw row data from query result (array of arrays) */
  rows: unknown[][];
  /** X-axis column name */
  xAxis?: string;
  /** Y-axis column names */
  yAxis?: string[];
  /** X-axis display label (full mode only) */
  xAxisLabel?: string;
  /** Y-axis display label (full mode only) */
  yAxisLabel?: string;
  /**
   * Rendering mode:
   * - "full": used in visualization builder/viewer (400px height, brush, legend, axis labels)
   * - "compact": used in dashboard widgets (fills container, no brush/legend/labels)
   */
  mode?: "full" | "compact";
  /** Unique ID for scoping SVG gradient IDs (prevents conflicts when multiple charts exist) */
  instanceId?: string;
}

export default function ChartRenderer({
  chartType,
  columns,
  rows,
  xAxis: xAxisProp,
  yAxis: yAxisProp,
  xAxisLabel,
  yAxisLabel,
  mode = "full",
  instanceId = "chart",
}: ChartRendererProps) {
  const isFull = mode === "full";
  const isCompact = mode === "compact";

  // Derive axis columns
  const xAxis = xAxisProp || columns[0] || "";
  const yAxis =
    yAxisProp && yAxisProp.length > 0
      ? yAxisProp
      : columns.length > 1
        ? [columns[1]]
        : [];

  // Build chart data: array of objects keyed by column name
  const chartData = useMemo(
    () =>
      rows.map((row) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      }),
    [columns, rows]
  );

  // â”€â”€ Table columns for AG Grid â”€â”€
  const gridColDefs: ColDef[] = useMemo(
    () =>
      columns.map((col) => ({
        field: col,
        headerName: col,
        sortable: true,
        resizable: true,
        filter: isFull,
        minWidth: 100,
        flex: 1,
        cellRenderer: (params: { value: unknown }) => {
          if (params.value === null || params.value === undefined)
            return '<span style="color:#9ca3af;font-style:italic">NULL</span>';
          return String(params.value);
        },
      })),
    [columns, isFull]
  );

  const gridRowData = useMemo(
    () =>
      rows.map((row) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        return obj;
      }),
    [columns, rows]
  );

  const gridOptions: GridOptions = useMemo(
    () => ({
      defaultColDef: {
        sortable: true,
        resizable: true,
        filter: true,
      },
      animateRows: true,
      pagination: true,
      paginationPageSize: isFull ? 10 : 5,
      paginationPageSizeSelector: isFull ? [10, 20, 50, 100] : [5, 10, 20],
      domLayout: undefined,
      suppressHorizontalScroll: false,
    }),
    [isFull]
  );

  // Quick filter state for table search
  const [quickFilter, setQuickFilter] = useState("");
  const debouncedQuickFilter = useDebouncedValue(quickFilter, 300);
  const onFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuickFilter(e.target.value);
  }, []);

  // Column visibility state
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const toggleCol = useCallback((col: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }, []);

  const visibleGridColDefs = useMemo(
    () => gridColDefs.filter((c) => !hiddenCols.has(c.field as string)),
    [gridColDefs, hiddenCols]
  );

  // â”€â”€ Empty state â”€â”€
  if (chartData.length === 0) {
    return (
      <Empty
        description="No data"
        image={isCompact ? Empty.PRESENTED_IMAGE_SIMPLE : undefined}
      />
    );
  }

  // â”€â”€ Sizing â”€â”€
  const fontSize = isFull ? 12 : 10;
  const tickStyle = { fontSize, fill: "#6b7280" };
  const height = isFull ? 400 : "100%";
  const margin = isFull
    ? { top: 5, right: 20, left: 0, bottom: 5 }
    : { top: 5, right: 10, left: 0, bottom: 5 };
  const showBrush = chartData.length > 10;
  const defaultEndIndex = Math.min(chartData.length, 10) - 1;
  const legendStyle = isFull
    ? { paddingTop: 8, fontSize: 13 }
    : { paddingTop: 4, fontSize: 11 };

  // Axis label wrapper
  const xLabel = xAxisLabel || xAxis;
  const yLabel = yAxisLabel || (yAxis.length === 1 ? yAxis[0] : "Value");
  const axisLabelStyle: React.CSSProperties = {
    textAlign: "center",
    fontSize: isFull ? 13 : 11,
    color: "#6b7280",
    fontWeight: 500,
    letterSpacing: 0.2,
  };

  const wrapChart = (chart: React.ReactNode) => {
    return (
      <div style={{ display: "flex", alignItems: "stretch", height: isCompact ? "100%" : undefined }}>
        <div
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            ...axisLabelStyle,
            padding: "0 4px",
          }}
        >
          {yLabel}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, minHeight: 0 }}>{chart}</div>
          <div style={{ ...axisLabelStyle, marginTop: isFull ? 4 : 2, flexShrink: 0 }}>{xLabel}</div>
        </div>
      </div>
    );
  };

  // â”€â”€ Table â”€â”€
  if (chartType === "table") {
    const allVisible = hiddenCols.size === 0;
    const colMenuItems = [
      {
        key: "_toggle_all",
        label: (
          <a
            onClick={(e) => {
              e.stopPropagation();
              setHiddenCols(allVisible ? new Set(columns) : new Set());
            }}
            style={{ color: "#4F6CF7", fontWeight: 500, fontSize: 12 }}
          >
            {allVisible ? "Unselect All" : "Select All"}
          </a>
        ),
      },
      { type: "divider" as const, key: "_divider" },
      ...columns.map((col) => ({
        key: col,
        label: (
          <Checkbox
            checked={!hiddenCols.has(col)}
            onChange={() => toggleCol(col)}
            style={{ width: "100%" }}
          >
            {col}
          </Checkbox>
        ),
      })),
    ];

    return (
      <div style={{ height: isFull ? 480 : "100%", width: "100%", display: "flex", flexDirection: "column" }}>
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Dropdown
            menu={{ items: colMenuItems }}
            trigger={["click"]}
            placement="bottomLeft"
          >
            <Button size={isCompact ? "small" : "middle"}>
              Columns ({columns.length - hiddenCols.size}/{columns.length})
            </Button>
          </Dropdown>
          <Input.Search
            placeholder="Search..."
            allowClear
            onChange={onFilterChange}
            size={isCompact ? "small" : "middle"}
            style={{ width: isFull ? 260 : 180 }}
          />
        </div>
        <div
          className="ag-theme-alpine chart-renderer-grid"
          style={{ flex: 1, minHeight: 0, width: "100%" }}
        >
          <AgGridReact
            modules={[AllCommunityModule]}
            rowData={gridRowData}
            columnDefs={visibleGridColDefs}
            gridOptions={gridOptions}
            quickFilterText={debouncedQuickFilter}
          />
        </div>
      </div>
    );
  }

  // Non-table charts need axes
  if (chartType !== "pie" && (!xAxis || yAxis.length === 0)) {
    return (
      <Empty description="Select X-Axis and at least one Y-Axis column" />
    );
  }

  // â”€â”€ Bar â”€â”€
  if (chartType === "bar") {
    return wrapChart(
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={margin}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey={xAxis}
            tick={tickStyle}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
          <RTooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(79,108,247,0.06)" }}
          />
          <Legend wrapperStyle={legendStyle} />
          {yAxis.map((col, i) => (
            <Bar
              key={col}
              dataKey={col}
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              radius={[4, 4, 0, 0]}
              animationDuration={ANIM_DURATION}
              animationEasing={ANIM_EASING}
            />
          ))}
          {showBrush && (
            <Brush
              dataKey={xAxis}
              height={30}
              stroke="#4F6CF7"
              fill="#f8fafc"
              startIndex={0}
              endIndex={defaultEndIndex}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // â”€â”€ Line â”€â”€
  if (chartType === "line") {
    return wrapChart(
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={margin}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey={xAxis}
            tick={tickStyle}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
          <RTooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={legendStyle} />
          {yAxis.map((col, i) => (
            <Line
              key={col}
              type="monotone"
              dataKey={col}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={isFull ? 2.5 : 2}
              dot={{
                r: isFull ? 3 : 2,
                fill: "#fff",
                stroke: CHART_COLORS[i % CHART_COLORS.length],
                strokeWidth: isFull ? 2 : 1.5,
              }}
              activeDot={{
                r: isFull ? 6 : 4,
                stroke: CHART_COLORS[i % CHART_COLORS.length],
                strokeWidth: 2,
                fill: "#fff",
              }}
              animationDuration={ANIM_DURATION}
              animationEasing={ANIM_EASING}
            />
          ))}
          {showBrush && (
            <Brush
              dataKey={xAxis}
              height={30}
              stroke="#4F6CF7"
              fill="#f8fafc"
              startIndex={0}
              endIndex={defaultEndIndex}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // â”€â”€ Area â”€â”€
  if (chartType === "area") {
    return wrapChart(
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={margin}>
          <defs>
            {yAxis.map((col, i) => (
              <linearGradient
                key={col}
                id={`grad-${instanceId}-${i}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={CHART_COLORS[i % CHART_COLORS.length]}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={CHART_COLORS[i % CHART_COLORS.length]}
                  stopOpacity={0.02}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey={xAxis}
            tick={tickStyle}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
          <RTooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={legendStyle} />
          {yAxis.map((col, i) => (
            <Area
              key={col}
              type="monotone"
              dataKey={col}
              fill={`url(#grad-${instanceId}-${i})`}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              animationDuration={ANIM_DURATION}
              animationEasing={ANIM_EASING}
            />
          ))}
          {showBrush && (
            <Brush
              dataKey={xAxis}
              height={30}
              stroke="#4F6CF7"
              fill="#f8fafc"
              startIndex={0}
              endIndex={defaultEndIndex}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // â”€â”€ Pie â”€â”€
  if (chartType === "pie") {
    const valueCol = yAxis[0];
    if (!valueCol) {
      return <Empty description="Select a Y-Axis column for pie chart" />;
    }
    const sorted = [...chartData].sort(
      (a, b) => (Number(b[valueCol]) || 0) - (Number(a[valueCol]) || 0)
    );
    const hasMore = sorted.length > 10;
    const pieData = hasMore ? sorted.slice(0, 10) : sorted;

    return (
      <div style={{ height: isCompact ? "100%" : undefined }}>
        <ResponsiveContainer width="100%" height={isFull ? 400 : "100%"}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey={valueCol}
              nameKey={xAxis}
              cx="50%"
              cy="50%"
              innerRadius={isFull ? 60 : "35%"}
              outerRadius={isFull ? 140 : "70%"}
              paddingAngle={2}
              animationDuration={ANIM_DURATION}
              animationEasing={ANIM_EASING}
              label={
                isFull
                  ? ({ name, percent }) =>
                      `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`
                  : ({ percent }) =>
                      `${((percent ?? 0) * 100).toFixed(0)}%`
              }
              labelLine={{ stroke: "#d1d5db", strokeWidth: 1 }}
            >
              {pieData.map((_, idx) => (
                <Cell
                  key={idx}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  stroke="#fff"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <RTooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={legendStyle} />
          </PieChart>
        </ResponsiveContainer>
        {hasMore && (
          <div
            style={{
              textAlign: "center",
              color: "#9ca3af",
              fontSize: isFull ? 13 : 11,
              marginTop: isFull ? 4 : 2,
            }}
          >
            Showing top 10 of {sorted.length} items
          </div>
        )}
      </div>
    );
  }

  // â”€â”€ Scatter â”€â”€
  if (chartType === "scatter") {
    const valueCol = yAxis[0];
    if (!valueCol) {
      return <Empty description="Select a Y-Axis column for scatter plot" />;
    }
    return wrapChart(
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey={xAxis}
            name={xAxis}
            tick={tickStyle}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis
            dataKey={valueCol}
            name={valueCol}
            tick={tickStyle}
            axisLine={false}
            tickLine={false}
          />
          <RTooltip
            content={<CustomTooltip />}
            cursor={{ strokeDasharray: "3 3" }}
          />
          <Legend wrapperStyle={legendStyle} />
          <Scatter
            name={`${xAxis} vs ${valueCol}`}
            dataKey={valueCol}
            fill={CHART_COLORS[0]}
            animationDuration={ANIM_DURATION}
            animationEasing={ANIM_EASING}
          />
          {showBrush && (
            <Brush
              dataKey={xAxis}
              height={30}
              stroke="#4F6CF7"
              fill="#f8fafc"
              startIndex={0}
              endIndex={defaultEndIndex}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  // Fallback
  return (
    <div
      style={{
        padding: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: isCompact ? "100%" : 200,
      }}
    >
      <Text type="secondary">Unsupported chart type: {chartType}</Text>
    </div>
  );
}
