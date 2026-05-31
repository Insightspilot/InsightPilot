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

interface FilterClause {
  id: number;
  field: string;
  operator: string;
  value: string;
}

interface SortClause {
  id: number;
  field: string;
  direction: 1 | -1;
}

type AggFunc = "" | "$sum" | "$avg" | "$min" | "$max" | "$count";

interface FieldSelection {
  field: string;
  aggregate: AggFunc;
}

interface MongoQueryBuilderProps {
  dsId: string;
  dsName: string;
  collection: string;        // "table" name from introspection
  database: string;           // "schema" from introspection
  columns: ColumnInfo[];      // inferred fields
  onBack: () => void;
  onVisualize?: (query: string, resultColumns: string[], resultData: unknown[][]) => void;
}

const OPERATORS = [
  { value: "$eq", label: "equals (=)" },
  { value: "$ne", label: "not equals (â‰ )" },
  { value: "$gt", label: "greater than (>)" },
  { value: "$gte", label: "greater or equal (â‰¥)" },
  { value: "$lt", label: "less than (<)" },
  { value: "$lte", label: "less or equal (â‰¤)" },
  { value: "$regex", label: "matches regex" },
  { value: "$in", label: "in list" },
  { value: "$exists_true", label: "exists" },
  { value: "$exists_false", label: "does not exist" },
];

const NO_VALUE_OPS = new Set(["$exists_true", "$exists_false"]);

let nextId = 1;

export default function MongoQueryBuilder({
  dsId,
  dsName,
  collection,
  database,
  columns,
  onBack,
  onVisualize,
}: MongoQueryBuilderProps) {
  const { message } = App.useApp();
  const { track } = useActivityTracker();

  // Field selection (projection + aggregation)
  const [selectedFields, setSelectedFields] = useState<FieldSelection[]>(
    columns.map((c) => ({ field: c.column_name, aggregate: "" as AggFunc }))
  );
  const allSelected = selectedFields.length === columns.length;
  const hasAggregates = selectedFields.some((f) => f.aggregate !== "");

  // Filter
  const [filterClauses, setFilterClauses] = useState<FilterClause[]>([]);

  // Sort
  const [sortClauses, setSortClauses] = useState<SortClause[]>([]);

  // Limit
  const [limit, setLimit] = useState<number | null>(100);

  // Field search filter
  const [fieldSearch, setFieldSearch] = useState("");

  // Mode (visual vs raw JSON)
  const [queryMode, setQueryMode] = useState<"visual" | "raw">("visual");
  const [rawJson, setRawJson] = useState("");

  // Execution state
  const [queryResult, setQueryResult] = useState<QueryResultData | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  // â”€â”€ Generate MongoDB JSON query from visual builder â”€â”€

  const generatedQuery = useMemo(() => {
    const query: Record<string, unknown> = { collection };

    // Build filter object (used in both find and $match)
    const filter: Record<string, unknown> = {};
    for (const fc of filterClauses) {
      if (!fc.field || !fc.operator) continue;
      if (!NO_VALUE_OPS.has(fc.operator) && !fc.value.trim()) continue;

      if (fc.operator === "$exists_true") {
        filter[fc.field] = { $exists: true };
      } else if (fc.operator === "$exists_false") {
        filter[fc.field] = { $exists: false };
      } else if (fc.operator === "$eq") {
        filter[fc.field] = parseValue(fc.value);
      } else if (fc.operator === "$in") {
        try {
          filter[fc.field] = { $in: JSON.parse(fc.value) };
        } catch {
          filter[fc.field] = { $in: [fc.value] };
        }
      } else {
        filter[fc.field] = { [fc.operator]: parseValue(fc.value) };
      }
    }

    if (hasAggregates) {
      // â”€â”€ Aggregation pipeline mode â”€â”€
      const pipeline: Record<string, unknown>[] = [];

      // $match stage
      if (Object.keys(filter).length > 0) {
        pipeline.push({ $match: filter });
      }

      // $group stage
      const groupId: Record<string, string> = {};
      const groupAccumulators: Record<string, unknown> = {};
      const nonAggFields = selectedFields.filter((f) => !f.aggregate);
      const aggFields = selectedFields.filter((f) => f.aggregate);

      for (const f of nonAggFields) {
        groupId[f.field] = `$${f.field}`;
      }

      for (const f of aggFields) {
        const alias = `${f.aggregate.replace("$", "")}__${f.field}`;
        if (f.aggregate === "$count") {
          groupAccumulators[alias] = { $sum: 1 };
        } else {
          groupAccumulators[alias] = { [f.aggregate]: `$${f.field}` };
        }
      }

      pipeline.push({
        $group: {
          _id: Object.keys(groupId).length > 0 ? groupId : null,
          ...groupAccumulators,
        },
      });

      // $project stage â€” flatten _id fields and rename
      const project: Record<string, unknown> = { _id: 0 };
      for (const key of Object.keys(groupId)) {
        project[key] = `$_id.${key}`;
      }
      for (const f of aggFields) {
        const alias = `${f.aggregate.replace("$", "")}__${f.field}`;
        project[alias] = 1;
      }
      pipeline.push({ $project: project });

      // $sort stage
      if (sortClauses.length > 0) {
        const sort: Record<string, number> = {};
        for (const sc of sortClauses) {
          if (sc.field) sort[sc.field] = sc.direction;
        }
        if (Object.keys(sort).length > 0) {
          pipeline.push({ $sort: sort });
        }
      }

      // $limit stage
      if (limit != null && limit > 0) {
        pipeline.push({ $limit: limit });
      }

      query.pipeline = pipeline;
    } else {
      // â”€â”€ Simple find mode â”€â”€
      if (Object.keys(filter).length > 0) {
        query.filter = filter;
      }

      // Build projection
      if (!allSelected && selectedFields.length > 0) {
        const projection: Record<string, number> = {};
        for (const f of selectedFields) {
          projection[f.field] = 1;
        }
        query.projection = projection;
      }

      // Build sort
      if (sortClauses.length > 0) {
        const sort: Record<string, number> = {};
        for (const sc of sortClauses) {
          if (sc.field) sort[sc.field] = sc.direction;
        }
        if (Object.keys(sort).length > 0) {
          query.sort = sort;
        }
      }
    }

    return JSON.stringify(query, null, 2);
  }, [collection, selectedFields, allSelected, hasAggregates, filterClauses, sortClauses, limit]);

  const activeQuery = queryMode === "raw" ? rawJson : generatedQuery;

  // â”€â”€ Handlers â”€â”€

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedFields([]);
    } else {
      setSelectedFields(columns.map((c) => ({ field: c.column_name, aggregate: "" as AggFunc })));
    }
  };

  const toggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.some((f) => f.field === field)
        ? prev.filter((f) => f.field !== field)
        : [...prev, { field, aggregate: "" as AggFunc }]
    );
  };

  const setFieldAggregate = (field: string, agg: AggFunc) => {
    setSelectedFields((prev) =>
      prev.map((f) => (f.field === field ? { ...f, aggregate: agg } : f))
    );
  };

  const addFilter = () => {
    setFilterClauses((prev) => [
      ...prev,
      { id: nextId++, field: columns[0]?.column_name || "", operator: "$eq", value: "" },
    ]);
  };

  const updateFilter = (id: number, field: keyof FilterClause, value: string | number) => {
    setFilterClauses((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const removeFilter = (id: number) => {
    setFilterClauses((prev) => prev.filter((f) => f.id !== id));
  };

  const addSort = () => {
    setSortClauses((prev) => [
      ...prev,
      { id: nextId++, field: columns[0]?.column_name || "", direction: 1 },
    ]);
  };

  const updateSort = (id: number, field: keyof SortClause, value: string | number) => {
    setSortClauses((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const removeSort = (id: number) => {
    setSortClauses((prev) => prev.filter((s) => s.id !== id));
  };

  const switchToRaw = () => {
    setRawJson(generatedQuery);
    setQueryMode("raw");
  };

  const switchToVisual = () => {
    setQueryMode("visual");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(activeQuery);
    message.success("Query copied to clipboard");
  };

  // â”€â”€ Execute â”€â”€

  const handleExecute = useCallback(async () => {
    if (!activeQuery.trim()) {
      message.warning("No query to execute");
      return;
    }

    // Validate JSON
    try {
      JSON.parse(activeQuery);
    } catch {
      message.error("Invalid JSON query");
      return;
    }

    setQueryLoading(true);
    setQueryError(null);
    setQueryResult(null);
    setExecutionTime(null);
    const start = performance.now();
    try {
      const maxRows = limit != null && limit > 0 ? Math.min(limit, 1000) : 1000;
      const result = await executeQueryAction(dsId, activeQuery, maxRows);
      const elapsed = Math.round(performance.now() - start);
      setExecutionTime(elapsed);
      if (result.ok && result.data) {
        setQueryResult(result.data);
        track("query.executed", {
          resourceType: "datasource",
          resourceId: dsId,
          metadata: { execution_time_ms: elapsed, row_count: result.data.row_count, collection, is_aggregation: hasAggregates },
        });
      } else {
        setQueryError(result.error || "Query execution failed");
      }
    } catch {
      setQueryError("Query execution failed");
    } finally {
      setQueryLoading(false);
    }
  }, [activeQuery, dsId, limit, message, track, collection, hasAggregates]);

  // â”€â”€ Field options for selects â”€â”€

  // Filters can use any field in the collection
  const allFieldOptions = useMemo(() => {
    return columns.map((c) => ({
      value: c.column_name,
      label: (
        <span>
          {c.column_name}{" "}
          <span style={{ color: "#999", fontSize: 11 }}>{c.data_type}</span>
        </span>
      ),
    }));
  }, [columns]);

  // Sort uses aggregate aliases in aggregation mode
  const sortFieldOptions = useMemo(() => {
    if (hasAggregates) {
      const opts: { value: string; label: React.ReactNode }[] = [];
      for (const f of selectedFields) {
        if (!f.aggregate) {
          opts.push({ value: f.field, label: f.field });
        } else {
          const alias = `${f.aggregate.replace("$", "")}__${f.field}`;
          opts.push({ value: alias, label: alias });
        }
      }
      return opts;
    }
    return allFieldOptions;
  }, [hasAggregates, selectedFields, allFieldOptions]);

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
        if (typeof val === "object") return <Text code>{JSON.stringify(val)}</Text>;
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
              { title: database },
              { title: collection },
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
          type={queryMode === "visual" ? "primary" : "default"}
          size="small"
          icon={<TableOutlined />}
          onClick={switchToVisual}
        >
          Visual
        </Button>
        <Button
          type={queryMode === "raw" ? "primary" : "default"}
          size="small"
          icon={<CodeOutlined />}
          onClick={switchToRaw}
        >
          JSON
        </Button>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
        {/* Left: Builder controls */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {queryMode === "visual" ? (
            <>
              {/* Fields (Projection) */}
              <Card size="small" bordered style={{ borderColor: "#e2e8f0", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
                  <Text strong style={{ fontSize: 14 }}>Fields</Text>
                  <Tag
                    color={allSelected ? "green" : "blue"}
                    style={{ margin: 0, borderRadius: 10, fontSize: 11 }}
                  >
                    {selectedFields.length} of {columns.length} selected
                  </Tag>
                  {hasAggregates && (
                    <Tag color="orange" style={{ margin: 0, borderRadius: 10, fontSize: 11 }}>
                      Aggregation
                    </Tag>
                  )}
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
                  placeholder="Search fields..."
                  prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                  allowClear
                  size="small"
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                {hasAggregates && (
                  <Alert
                    type="info"
                    showIcon
                    banner
                    style={{ marginBottom: 10, borderRadius: 6 }}
                    message={
                      <span style={{ fontSize: 12 }}>
                        Fields without an aggregate function become <b>GROUP BY</b> fields.
                        The query will use an aggregation pipeline.
                      </span>
                    }
                  />
                )}
                <div style={{ maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: 6,
                    }}
                  >
                    {columns
                      .filter((c) =>
                        !fieldSearch ||
                        c.column_name.toLowerCase().includes(fieldSearch.toLowerCase())
                      )
                      .map((c) => {
                        const isSelected = selectedFields.some((f) => f.field === c.column_name);
                        const fieldSel = selectedFields.find((f) => f.field === c.column_name);
                        return (
                          <div
                            key={c.column_name}
                            onClick={() => toggleField(c.column_name)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: `1px solid ${isSelected ? "#00684A" : "#e2e8f0"}`,
                              background: isSelected ? "#f0faf5" : "#f8fafc",
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
                                  style={{ width: 90 }}
                                  value={fieldSel?.aggregate || ""}
                                  onChange={(val) => setFieldAggregate(c.column_name, val as AggFunc)}
                                  options={[
                                    { value: "", label: "â€”" },
                                    { value: "$count", label: "COUNT" },
                                    { value: "$sum", label: "SUM" },
                                    { value: "$avg", label: "AVG" },
                                    { value: "$min", label: "MIN" },
                                    { value: "$max", label: "MAX" },
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
                    !fieldSearch ||
                    c.column_name.toLowerCase().includes(fieldSearch.toLowerCase())
                  ).length === 0 && (
                    <Text
                      type="secondary"
                      style={{ display: "block", textAlign: "center", padding: 16 }}
                    >
                      No fields match &quot;{fieldSearch}&quot;
                    </Text>
                  )}
                </div>
              </Card>

              {/* Filters */}
              <Card size="small" bordered style={{ borderColor: "#e2e8f0", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                  <Text strong style={{ flex: 1 }}>Filters</Text>
                  <Button type="link" size="small" icon={<PlusOutlined />} onClick={addFilter}>
                    Add Filter
                  </Button>
                </div>
                {filterClauses.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    No filters applied. All documents will be returned.
                  </Text>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filterClauses.map((fc) => (
                      <div
                        key={fc.id}
                        style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
                      >
                        <Select
                          size="small"
                          style={{ width: 180 }}
                          value={fc.field}
                          onChange={(val) => updateFilter(fc.id, "field", val)}
                          options={allFieldOptions}
                          showSearch
                          optionFilterProp="value"
                        />
                        <Select
                          size="small"
                          style={{ width: 180 }}
                          value={fc.operator}
                          onChange={(val) => updateFilter(fc.id, "operator", val)}
                          options={OPERATORS}
                        />
                        {!NO_VALUE_OPS.has(fc.operator) && (
                          <Input
                            size="small"
                            style={{ width: 200 }}
                            placeholder={fc.operator === "$in" ? '["val1","val2"]' : "Value"}
                            value={fc.value}
                            onChange={(e) => updateFilter(fc.id, "value", e.target.value)}
                          />
                        )}
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => removeFilter(fc.id)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Sort + Limit */}
              <Card size="small" bordered style={{ borderColor: "#e2e8f0", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                  {/* Sort */}
                  <div style={{ flex: 1, minWidth: 300 }}>
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                      <Text strong style={{ flex: 1 }}>Sort</Text>
                      <Button type="link" size="small" icon={<PlusOutlined />} onClick={addSort}>
                        Add Sort
                      </Button>
                    </div>
                    {sortClauses.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        No sorting applied.
                      </Text>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {sortClauses.map((sc) => (
                          <div
                            key={sc.id}
                            style={{ display: "flex", gap: 8, alignItems: "center" }}
                          >
                            <Select
                              size="small"
                              style={{ width: 180 }}
                              value={sc.field}
                              onChange={(val) => updateSort(sc.id, "field", val)}
                              options={sortFieldOptions as { value: string; label: React.ReactNode }[]}
                              showSearch
                              optionFilterProp="value"
                            />
                            <Select
                              size="small"
                              style={{ width: 120 }}
                              value={sc.direction}
                              onChange={(val) => updateSort(sc.id, "direction", val)}
                              options={[
                                { value: 1, label: "Ascending" },
                                { value: -1, label: "Descending" },
                              ]}
                            />
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => removeSort(sc.id)}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Limit */}
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
            /* Raw JSON editor */
            <Card size="small" bordered style={{ borderColor: "#e2e8f0", marginBottom: 12 }}>
              <Text strong style={{ display: "block", marginBottom: 8 }}>
                MongoDB Query (JSON)
              </Text>
              <Alert
                type="info"
                showIcon
                message={
                  <span style={{ fontSize: 12 }}>
                    Format: <code>{`{"collection":"name","filter":{...},"projection":{...},"sort":{...}}`}</code>
                  </span>
                }
                style={{ marginBottom: 8 }}
              />
              <TextArea
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                placeholder={'{\n  "collection": "...",\n  "filter": {},\n  "projection": {},\n  "sort": {}\n}'}
                autoSize={{ minRows: 12, maxRows: 30 }}
                style={{ fontFamily: "monospace", fontSize: 13 }}
              />
            </Card>
          )}
        </div>

        {/* Right: Query Preview */}
        <Card
          size="small"
          bordered
          style={{
            borderColor: "#e2e8f0",
            width: 420,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
          }}
          styles={{ body: { flex: 1, display: "flex", flexDirection: "column" } }}
          title={
            <Space>
              <CodeOutlined />
              <Text strong>Query Preview</Text>
            </Space>
          }
          extra={
            <Tooltip title="Copy Query">
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
            {activeQuery || '// Build your query using the controls'}
          </pre>
          <div style={{ marginTop: 12 }}>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={queryLoading}
              onClick={handleExecute}
              block
              size="large"
              style={{ background: "#00684A" }}
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
                  <Tag color="green">{queryResult.row_count} documents</Tag>
                  {queryResult.truncated && <Tag color="warning">Truncated</Tag>}
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
                      onVisualize(activeQuery, queryResult.columns, queryResult.rows)
                    }
                  >
                    Visualize
                  </Button>
                ) : null
              }
            >
              {queryResult.row_count === 0 ? (
                <Text type="secondary">No documents returned.</Text>
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
                    showTotal: (total) => `${total} documents`,
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

// â”€â”€ Helper â”€â”€

function parseValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  const num = Number(trimmed);
  if (trimmed !== "" && !isNaN(num)) return num;
  return trimmed;
}
