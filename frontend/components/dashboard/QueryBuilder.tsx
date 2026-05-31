"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Card,
  Button,
  Checkbox,
  Select,
  Input,
  InputNumber,
  Table,
  Tag,
  Typography,
  Space,
  Divider,
  App,
  Alert,
  Breadcrumb,
  Tooltip,
} from "antd";
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  TableOutlined,
  CodeOutlined,
  SearchOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import { executeQueryAction } from "@/lib/actions";
import type { ColumnInfo, QueryResultData } from "@/lib/actions";
import { useActivityTracker } from "@/components/providers/useActivityTracker";

const { Text, Title } = Typography;
const { TextArea } = Input;

// â”€â”€ Types â”€â”€

type LogicOp = "AND" | "OR";

interface WhereClause {
  id: number;
  column: string;
  operator: string;
  value: string;
  logic: LogicOp; // logic operator BEFORE this clause (ignored for first)
}

interface OrderByClause {
  id: number;
  column: string;
  direction: "ASC" | "DESC";
}

type AggFunc = "" | "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";

interface ColumnSelection {
  column: string;
  aggregate: AggFunc;
}

interface QueryBuilderProps {
  dsId: string;
  dsName: string;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  onBack: () => void;
  onVisualize?: (sql: string, resultColumns: string[], resultData: unknown[][]) => void;
}

const OPERATORS = [
  { value: "=", label: "=" },
  { value: "!=", label: "!=" },
  { value: ">", label: ">" },
  { value: ">=", label: ">=" },
  { value: "<", label: "<" },
  { value: "<=", label: "<=" },
  { value: "LIKE", label: "LIKE" },
  { value: "ILIKE", label: "ILIKE" },
  { value: "IN", label: "IN" },
  { value: "IS NULL", label: "IS NULL" },
  { value: "IS NOT NULL", label: "IS NOT NULL" },
];

const NO_VALUE_OPS = new Set(["IS NULL", "IS NOT NULL"]);

let nextId = 1;

export default function QueryBuilder({
  dsId,
  dsName,
  schema,
  table,
  columns,
  onBack,
  onVisualize,
}: QueryBuilderProps) {
  const { message } = App.useApp();
  const { track } = useActivityTracker();

  // Column selection
  const [selectedCols, setSelectedCols] = useState<ColumnSelection[]>(
    columns.map((c) => ({ column: c.column_name, aggregate: "" as AggFunc }))
  );
  const allSelected = selectedCols.length === columns.length;
  const hasAggregates = selectedCols.some((c) => c.aggregate !== "");

  // WHERE
  const [whereClauses, setWhereClauses] = useState<WhereClause[]>([]);

  // ORDER BY
  const [orderByClauses, setOrderByClauses] = useState<OrderByClause[]>([]);

  // LIMIT
  const [limit, setLimit] = useState<number | null>(100);

  // Column search filter
  const [colSearch, setColSearch] = useState("");

  // SQL mode (visual vs raw)
  const [sqlMode, setSqlMode] = useState<"visual" | "raw">("visual");
  const [rawSql, setRawSql] = useState("");

  // Execution state
  const [queryResult, setQueryResult] = useState<QueryResultData | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  // â”€â”€ Generate SQL from visual builder â”€â”€

  const generatedSql = useMemo(() => {
    // Build SELECT columns
    let colExpressions: string[];
    if (selectedCols.length === 0) {
      colExpressions = ["*"];
    } else if (allSelected && !hasAggregates) {
      colExpressions = ["*"];
    } else {
      colExpressions = selectedCols.map((c) => {
        const quoted = `"${c.column}"`;
        if (c.aggregate) {
          return `${c.aggregate}(${quoted}) AS "${c.aggregate}(${c.column})"`;
        }
        return quoted;
      });
    }

    let sql = `SELECT ${colExpressions.join(", ")}\nFROM "${schema}"."${table}"`;

    // WHERE
    const validWheres = whereClauses.filter(
      (w) => w.column && w.operator && (NO_VALUE_OPS.has(w.operator) || w.value.trim())
    );
    if (validWheres.length > 0) {
      const conditions = validWheres.map((w, idx) => {
        let expr: string;
        if (NO_VALUE_OPS.has(w.operator)) {
          expr = `"${w.column}" ${w.operator}`;
        } else if (w.operator === "IN") {
          expr = `"${w.column}" IN (${w.value})`;
        } else {
          expr = `"${w.column}" ${w.operator} '${w.value.replace(/'/g, "''")}'`;
        }
        if (idx === 0) return expr;
        return `${w.logic} ${expr}`;
      });
      sql += `\nWHERE ${conditions.join("\n  ")}`;
    }

    // GROUP BY (auto-added when aggregates are used)
    if (hasAggregates) {
      const nonAggCols = selectedCols.filter((c) => !c.aggregate);
      // Also include ORDER BY columns that aren't already covered
      const validOrders = orderByClauses.filter((o) => o.column);
      const orderOnlyCols = validOrders
        .filter((o) => !selectedCols.some((sc) => sc.column === o.column))
        .map((o) => o.column);
      const groupCols = [
        ...nonAggCols.map((c) => c.column),
        ...orderOnlyCols,
      ];
      if (groupCols.length > 0) {
        sql += `\nGROUP BY ${[...new Set(groupCols)].map((c) => `"${c}"`).join(", ")}`;
      }
    }

    // ORDER BY
    const validOrders = orderByClauses.filter((o) => o.column);
    if (validOrders.length > 0) {
      const orderExprs = validOrders.map((o) => {
        if (hasAggregates) {
          const sel = selectedCols.find((sc) => sc.column === o.column);
          if (sel?.aggregate) {
            return `${sel.aggregate}("${o.column}") ${o.direction}`;
          }
        }
        return `"${o.column}" ${o.direction}`;
      });
      sql += `\nORDER BY ${orderExprs.join(", ")}`;
    }

    // LIMIT
    if (limit != null && limit > 0) {
      sql += `\nLIMIT ${limit}`;
    }

    return sql;
  }, [selectedCols, allSelected, hasAggregates, schema, table, whereClauses, orderByClauses, limit]);

  const activeSql = sqlMode === "raw" ? rawSql : generatedSql;

  // â”€â”€ Handlers â”€â”€

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedCols([]);
    } else {
      setSelectedCols(columns.map((c) => ({ column: c.column_name, aggregate: "" as AggFunc })));
    }
  };

  const toggleColumn = (col: string) => {
    setSelectedCols((prev) =>
      prev.some((c) => c.column === col)
        ? prev.filter((c) => c.column !== col)
        : [...prev, { column: col, aggregate: "" as AggFunc }]
    );
  };

  const setColumnAggregate = (col: string, agg: AggFunc) => {
    setSelectedCols((prev) =>
      prev.map((c) => (c.column === col ? { ...c, aggregate: agg } : c))
    );
  };

  const addWhere = () => {
    setWhereClauses((prev) => [
      ...prev,
      { id: nextId++, column: columns[0]?.column_name || "", operator: "=", value: "", logic: "AND" as LogicOp },
    ]);
  };

  const updateWhere = (id: number, field: keyof WhereClause, value: string) => {
    setWhereClauses((prev) =>
      prev.map((w) => (w.id === id ? { ...w, [field]: value } : w))
    );
  };

  const removeWhere = (id: number) => {
    setWhereClauses((prev) => prev.filter((w) => w.id !== id));
  };

  const addOrderBy = () => {
    setOrderByClauses((prev) => [
      ...prev,
      { id: nextId++, column: columns[0]?.column_name || "", direction: "ASC" },
    ]);
  };

  const updateOrderBy = (id: number, field: keyof OrderByClause, value: string) => {
    setOrderByClauses((prev) =>
      prev.map((o) => (o.id === id ? { ...o, [field]: value } : o))
    );
  };

  const removeOrderBy = (id: number) => {
    setOrderByClauses((prev) => prev.filter((o) => o.id !== id));
  };

  const switchToRaw = () => {
    setRawSql(generatedSql);
    setSqlMode("raw");
  };

  const switchToVisual = () => {
    setSqlMode("visual");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(activeSql);
    message.success("SQL copied to clipboard");
  };

  // â”€â”€ Execute â”€â”€

  const handleExecute = useCallback(async () => {
    if (!activeSql.trim()) {
      message.warning("No SQL to execute");
      return;
    }
    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    setExecutionTime(null);
    const start = performance.now();
    try {
      const maxRows = limit != null && limit > 0 ? Math.min(limit, 1000) : 1000;
      const result = await executeQueryAction(dsId, activeSql, maxRows);
      const elapsed = Math.round(performance.now() - start);
      setExecutionTime(elapsed);
      if (result.ok && result.data) {
        setQueryResult(result.data);
        track("query.executed", {
          resourceType: "datasource",
          resourceId: dsId,
          metadata: { execution_time_ms: elapsed, row_count: result.data.row_count, table, schema },
        });
      } else {
        setQueryError(result.error || "Query execution failed");
      }
    } catch {
      setQueryError("Query execution failed");
    } finally {
      setQueryLoading(false);
    }
  }, [activeSql, dsId, limit, message, track, table, schema]);

  // â”€â”€ Column options for selects â”€â”€

  const columnOptions = columns.map((c) => ({
    value: c.column_name,
    label: (
      <span>
        {c.column_name}{" "}
        <span style={{ color: "#999", fontSize: 11 }}>{c.data_type}</span>
      </span>
    ),
  }));

  // â”€â”€ Result table columns â”€â”€

  const resultTableColumns = useMemo(() => {
    if (!queryResult) return [];
    return queryResult.columns.map((col, idx) => ({
      title: col,
      dataIndex: idx.toString(),
      key: col,
      ellipsis: true,
      render: (val: unknown) => {
        if (val === null) return <Text type="secondary" italic>NULL</Text>;
        return String(val);
      },
    }));
  }, [queryResult]);

  const resultTableData = useMemo(() => {
    if (!queryResult) return [];
    return queryResult.rows.map((row, rowIdx) => {
      const record: Record<string, unknown> = { key: rowIdx };
      row.forEach((val, colIdx) => {
        record[colIdx.toString()] = val;
      });
      return record;
    });
  }, [queryResult]);

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
        <div>
          <Breadcrumb
            style={{ fontSize: 12, marginBottom: 2 }}
            items={[
              { title: dsName },
              { title: schema },
              { title: table },
            ]}
          />
          <Title level={4} style={{ margin: 0 }}>
            Query Builder
          </Title>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <Button
          type={sqlMode === "visual" ? "primary" : "default"}
          size="small"
          icon={<TableOutlined />}
          onClick={switchToVisual}
        >
          Visual
        </Button>
        <Button
          type={sqlMode === "raw" ? "primary" : "default"}
          size="small"
          icon={<CodeOutlined />}
          onClick={switchToRaw}
        >
          SQL
        </Button>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
        {/* Left: Builder controls */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {sqlMode === "visual" ? (
            <>
              {/* Columns */}
              <Card size="small" bordered style={{ borderColor: "#e2e8f0", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
                  <Text strong style={{ fontSize: 14 }}>Columns</Text>
                  <Tag
                    color={allSelected ? "green" : "blue"}
                    style={{ margin: 0, borderRadius: 10, fontSize: 11 }}
                  >
                    {selectedCols.length} of {columns.length} selected
                  </Tag>
                  <div style={{ flex: 1 }} />
                  <Button
                    type="default"
                    size="small"
                    onClick={toggleSelectAll}
                    style={{ fontSize: 12 }}
                  >
                    {allSelected ? "Clear All" : "Select All"}
                  </Button>
                </div>
                <Input
                  placeholder="Search columns..."
                  prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                  allowClear
                  size="small"
                  value={colSearch}
                  onChange={(e) => setColSearch(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                <div
                  style={{
                    maxHeight: 240,
                    overflowY: "auto",
                    paddingRight: 4,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: 6,
                    }}
                  >
                    {columns
                      .filter((c) =>
                        !colSearch || c.column_name.toLowerCase().includes(colSearch.toLowerCase())
                      )
                      .map((c) => {
                        const isSelected = selectedCols.some((s) => s.column === c.column_name);
                        const colSel = selectedCols.find((s) => s.column === c.column_name);
                        return (
                          <div
                            key={c.column_name}
                            onClick={() => toggleColumn(c.column_name)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: `1px solid ${isSelected ? "#1677ff" : "#e2e8f0"}`,
                              background: isSelected ? "#f0f7ff" : "#f8fafc",
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            <Checkbox
                              checked={isSelected}
                              style={{ pointerEvents: "none" }}
                            />
                            <div style={{ overflow: "hidden", flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 500,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {c.column_name}
                              </div>
                              <div style={{ fontSize: 11, color: "#999" }}>
                                {c.data_type}
                              </div>
                            </div>
                            {isSelected && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <Select
                                  size="small"
                                  style={{ width: 80 }}
                                  value={colSel?.aggregate || ""}
                                  onChange={(val) => setColumnAggregate(c.column_name, val as AggFunc)}
                                  options={[
                                    { value: "", label: "â€”" },
                                    { value: "COUNT", label: "COUNT" },
                                    { value: "SUM", label: "SUM" },
                                    { value: "AVG", label: "AVG" },
                                    { value: "MIN", label: "MIN" },
                                    { value: "MAX", label: "MAX" },
                                  ]}
                                  popupMatchSelectWidth={false}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  {columns.filter((c) =>
                    !colSearch || c.column_name.toLowerCase().includes(colSearch.toLowerCase())
                  ).length === 0 && (
                    <Text type="secondary" style={{ display: "block", textAlign: "center", padding: 16 }}>
                      No columns match &quot;{colSearch}&quot;
                    </Text>
                  )}
                </div>
              </Card>

              {hasAggregates && (
                <Alert
                  type="info"
                  showIcon
                  message="GROUP BY will be auto-applied to non-aggregated columns."
                  style={{ marginBottom: 12, fontSize: 12 }}
                />
              )}

              {/* WHERE */}
              <Card size="small" bordered style={{ borderColor: "#e2e8f0", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                  <Text strong style={{ flex: 1 }}>Filters (WHERE)</Text>
                  <Button type="link" size="small" icon={<PlusOutlined />} onClick={addWhere}>
                    Add Filter
                  </Button>
                </div>
                {whereClauses.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    No filters applied. Click &quot;Add Filter&quot; to add conditions.
                  </Text>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {whereClauses.map((w, idx) => (
                      <div key={w.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {idx > 0 && (
                          <Select
                            size="small"
                            style={{ width: 70 }}
                            value={w.logic}
                            onChange={(val) => updateWhere(w.id, "logic", val)}
                            options={[
                              { value: "AND", label: "AND" },
                              { value: "OR", label: "OR" },
                            ]}
                          />
                        )}
                        <Select
                          size="small"
                          style={{ width: 180 }}
                          value={w.column}
                          onChange={(val) => updateWhere(w.id, "column", val)}
                          options={columnOptions}
                          showSearch
                          optionFilterProp="value"
                        />
                        <Select
                          size="small"
                          style={{ width: 120 }}
                          value={w.operator}
                          onChange={(val) => updateWhere(w.id, "operator", val)}
                          options={OPERATORS}
                        />
                        {!NO_VALUE_OPS.has(w.operator) && (
                          <Input
                            size="small"
                            style={{ width: 200 }}
                            placeholder="Value"
                            value={w.value}
                            onChange={(e) => updateWhere(w.id, "value", e.target.value)}
                          />
                        )}
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => removeWhere(w.id)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* ORDER BY + LIMIT */}
              <Card size="small" bordered style={{ borderColor: "#e2e8f0", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                  {/* ORDER BY */}
                  <div style={{ flex: 1, minWidth: 300 }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                      <Text strong style={{ flex: 1 }}>Sort (ORDER BY)</Text>
                      <Button type="link" size="small" icon={<PlusOutlined />} onClick={addOrderBy}>
                        Add Sort
                      </Button>
                    </div>
                    {orderByClauses.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>No sorting applied.</Text>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {orderByClauses.map((o) => (
                          <div key={o.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <Select
                              size="small"
                              style={{ width: 180 }}
                              value={o.column}
                              onChange={(val) => updateOrderBy(o.id, "column", val)}
                              options={columnOptions}
                              showSearch
                              optionFilterProp="value"
                            />
                            <Select
                              size="small"
                              style={{ width: 100 }}
                              value={o.direction}
                              onChange={(val) => updateOrderBy(o.id, "direction", val)}
                              options={[
                                { value: "ASC", label: "ASC" },
                                { value: "DESC", label: "DESC" },
                              ]}
                            />
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => removeOrderBy(o.id)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* LIMIT */}
                  <div style={{ minWidth: 200 }}>
                    <Text strong style={{ display: "block", marginBottom: 8 }}>
                      Limit
                    </Text>
                    <Space>
                      <InputNumber
                        size="small"
                        min={1}
                        max={10000}
                        value={limit}
                        onChange={(val) => setLimit(val)}
                        style={{ width: 120 }}
                        placeholder="No limit"
                      />
                      {limit != null && (
                        <Button
                          size="small"
                          type="link"
                          danger
                          onClick={() => setLimit(null)}
                        >
                          Remove
                        </Button>
                      )}
                    </Space>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            /* Raw SQL editor */
            <Card size="small" bordered style={{ borderColor: "#e2e8f0", marginBottom: 12 }}>
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                SQL Query
              </Text>
              <TextArea
                value={rawSql}
                onChange={(e) => setRawSql(e.target.value)}
                placeholder="SELECT * FROM ..."
                autoSize={{ minRows: 12, maxRows: 30 }}
                style={{ fontFamily: "monospace", fontSize: 13 }}
              />
            </Card>
          )}
        </div>

        {/* Right: SQL Preview */}
        <Card
          size="small"
          bordered
          style={{ borderColor: "#e2e8f0", width: 420, flexShrink: 0, display: "flex", flexDirection: "column" }}
          styles={{ body: { flex: 1, display: "flex", flexDirection: "column" } }}
          title={
            <Space>
              <CodeOutlined />
              <Text strong>SQL Preview</Text>
            </Space>
          }
          extra={
            <Tooltip title="Copy SQL">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={copyToClipboard}
              />
            </Tooltip>
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
              flex: 1,
              maxHeight: 420,
              overflow: "auto",
            }}
          >
            {activeSql || "-- Build your query using the controls"}
          </pre>
          <div style={{ marginTop: 12 }}>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={queryLoading}
              onClick={handleExecute}
              block
              size="large"
            >
              Run Query
            </Button>
          </div>
        </Card>
      </div>

      {/* Results section */}
      {(queryResult || queryError) && (
        <>
          <Divider />
          {queryError && (
            <Alert
              type="error"
              message="Query Error"
              description={queryError}
              showIcon
              closable
              onClose={() => setQueryError(null)}
              style={{ marginBottom: 16 }}
            />
          )}
          {queryResult && (
            <Card
              size="small"
              bordered
              style={{ borderColor: "#e2e8f0" }}
              title={
                <Space>
                  <TableOutlined />
                  <Text strong>Results</Text>
                  <Tag color="blue">{queryResult.row_count} rows</Tag>
                  {queryResult.truncated && (
                    <Tag color="warning">Truncated</Tag>
                  )}
                  {executionTime != null && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {executionTime}ms
                    </Text>
                  )}
                </Space>
              }
              extra={
                queryResult.row_count > 0 && onVisualize ? (
                  <Button
                    type="primary"
                    icon={<BarChartOutlined />}
                    onClick={() =>
                      onVisualize(activeSql, queryResult.columns, queryResult.rows)
                    }
                  >
                    Visualize
                  </Button>
                ) : null
              }
            >
              {queryResult.row_count === 0 ? (
                <Text type="secondary">No rows returned.</Text>
              ) : (
                <Table
                  dataSource={resultTableData}
                  columns={resultTableColumns}
                  size="small"
                  scroll={{ x: "max-content" }}
                  pagination={{
                    pageSize: 20,
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "20", "50", "100"],
                    showTotal: (total) => `${total} rows`,
                  }}
                />
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
