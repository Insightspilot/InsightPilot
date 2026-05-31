"use client";

import { useState, useEffect, useCallback } from "react";
import { useDebouncedValue } from "@/lib/hooks";
import {
  Card,
  Select,
  Table,
  Input,
  Tag,
  Typography,
  Space,
  Spin,
  Empty,
  App,
  Breadcrumb,
  Badge,
  Button,
} from "antd";
import {
  DatabaseOutlined,
  TableOutlined,
  SearchOutlined,
  FileTextOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import {
  listDataSourcesAction,
  listSchemasAction,
  listTablesAction,
  listColumnsAction,
} from "@/lib/actions";
import type { SchemaInfo, TableInfo, ColumnInfo } from "@/lib/actions";
import { useActivityTracker } from "@/components/providers/useActivityTracker";
import QueryBuilder from "./QueryBuilder";
import MongoQueryBuilder from "./MongoQueryBuilder";
import VisualizationBuilder from "./VisualizationBuilder";

const { Text, Title } = Typography;

interface DataSource {
  id: string;
  name: string;
  ds_type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  postgresql: "blue",
  mysql: "orange",
  mssql: "purple",
  mongodb: "green",
};

const TYPE_LABELS: Record<string, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  mssql: "SQL Server",
  mongodb: "MongoDB",
};

export default function QueriesContent({ onNavigate }: { onNavigate?: (key: string) => void }) {
  const { message } = App.useApp();
  const { track } = useActivityTracker();

  // Step state
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [dsLoading, setDsLoading] = useState(false);
  const [selectedDsId, setSelectedDsId] = useState<string | null>(null);

  // Schema state
  const [schemas, setSchemas] = useState<SchemaInfo[]>([]);
  const [schemasLoading, setSchemasLoading] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);

  // Table state
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tablesTotal, setTablesTotal] = useState(0);
  const [tableSearch, setTableSearch] = useState("");
  const debouncedTableSearch = useDebouncedValue(tableSearch, 300);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);

  // Column preview state
  const [selectedTable, setSelectedTable] = useState<{
    schema: string;
    table: string;
  } | null>(null);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);

  // Query builder mode
  const [showBuilder, setShowBuilder] = useState(false);

  // Visualization mode
  const [showViz, setShowViz] = useState(false);
  const [vizSql, setVizSql] = useState("");
  const [vizColumns, setVizColumns] = useState<string[]>([]);
  const [vizData, setVizData] = useState<unknown[][]>([]);

  // Fetch data sources on mount
  useEffect(() => {
    (async () => {
      setDsLoading(true);
      try {
        const result = await listDataSourcesAction();
        if (result.ok && result.data) {
          setDataSources(result.data);
        }
      } finally {
        setDsLoading(false);
      }
    })();
  }, []);

  // Fetch schemas when data source selected
  useEffect(() => {
    if (!selectedDsId) {
      setSchemas([]);
      setSelectedSchema(null);
      return;
    }
    (async () => {
      setSchemasLoading(true);
      setSchemas([]);
      setSelectedSchema(null);
      setTables([]);
      setSelectedTable(null);
      setColumns([]);
      try {
        const result = await listSchemasAction(selectedDsId);
        if (result.ok && result.data) {
          setSchemas(result.data);
          // Auto-select if only one schema (common for simple DBs)
          if (result.data.length === 1) {
            setSelectedSchema(result.data[0].schema_name);
          }
        } else {
          message.error(result.error || "Failed to load schemas");
        }
      } catch {
        message.error("Failed to connect to data source");
      } finally {
        setSchemasLoading(false);
      }
    })();
  }, [selectedDsId, message]);

  // Fetch tables when schema selected or search/pagination changes
  const fetchTables = useCallback(async () => {
    if (!selectedDsId || !selectedSchema) return;
    setTablesLoading(true);
    try {
      const result = await listTablesAction(selectedDsId, {
        schema: selectedSchema,
        search: debouncedTableSearch || undefined,
        limit: tablePageSize,
        offset: (tablePage - 1) * tablePageSize,
      });
      if (result.ok && result.data) {
        setTables(result.data.tables);
        setTablesTotal(result.data.total);
      } else {
        message.error(result.error || "Failed to load tables");
      }
    } catch {
      message.error("Failed to fetch tables");
    } finally {
      setTablesLoading(false);
    }
  }, [selectedDsId, selectedSchema, debouncedTableSearch, tablePage, tablePageSize, message]);

  useEffect(() => {
    if (selectedSchema) {
      fetchTables();
    } else {
      setTables([]);
      setTablesTotal(0);
    }
  }, [selectedSchema, fetchTables]);

  // Reset pagination when search changes
  useEffect(() => {
    setTablePage(1);
  }, [debouncedTableSearch]);

  // Fetch columns when table selected
  useEffect(() => {
    if (!selectedDsId || !selectedTable) {
      setColumns([]);
      return;
    }
    (async () => {
      setColumnsLoading(true);
      try {
        const result = await listColumnsAction(
          selectedDsId,
          selectedTable.schema,
          selectedTable.table
        );
        if (result.ok && result.data) {
          setColumns(result.data);
        } else {
          message.error(result.error || "Failed to load columns");
        }
      } catch {
        message.error("Failed to fetch columns");
      } finally {
        setColumnsLoading(false);
      }
    })();
  }, [selectedDsId, selectedTable, message]);

  const handleTableSelect = (schema: string, table: string) => {
    setSelectedTable({ schema, table });
  };

  const selectedDs = dataSources.find((ds) => ds.id === selectedDsId);
  const isMongo = selectedDs?.ds_type === "mongodb";

  // â”€â”€ Table columns definition â”€â”€

  const tableColumns = [
    {
      title: "Table",
      key: "table_name",
      render: (_: unknown, record: TableInfo) => (
        <Space>
          {record.table_type === "VIEW" ? (
            <EyeOutlined style={{ color: "#8c8c8c" }} />
          ) : (
            <TableOutlined style={{ color: "#1890ff" }} />
          )}
          <Text strong>{record.table_name}</Text>
          {record.table_type === "VIEW" && (
            <Tag color="default" style={{ fontSize: 11 }}>
              VIEW
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Schema",
      dataIndex: "schema_name",
      key: "schema_name",
      width: 160,
      render: (schema: string) => <Text type="secondary">{schema}</Text>,
    },
    {
      title: "Est. Rows",
      dataIndex: "row_estimate",
      key: "row_estimate",
      width: 120,
      align: "right" as const,
      render: (val: number | null) =>
        val != null ? (
          <Text type="secondary">{val.toLocaleString()}</Text>
        ) : (
          <Text type="secondary">â€”</Text>
        ),
    },
  ];

  const columnTableColumns = [
    {
      title: "#",
      dataIndex: "ordinal_position",
      key: "ordinal_position",
      width: 50,
    },
    {
      title: "Column",
      dataIndex: "column_name",
      key: "column_name",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Type",
      dataIndex: "data_type",
      key: "data_type",
      render: (type: string) => (
        <Tag style={{ fontFamily: "monospace", fontSize: 12 }}>{type}</Tag>
      ),
    },
    {
      title: "Nullable",
      dataIndex: "is_nullable",
      key: "is_nullable",
      width: 90,
      render: (val: boolean) =>
        val ? (
          <Text type="secondary">Yes</Text>
        ) : (
          <Text strong>No</Text>
        ),
    },
    {
      title: "Default",
      dataIndex: "column_default",
      key: "column_default",
      ellipsis: true,
      render: (val: string | null) =>
        val ? (
          <Text code style={{ fontSize: 11 }}>
            {val}
          </Text>
        ) : (
          <Text type="secondary">â€”</Text>
        ),
    },
  ];

  // â”€â”€ No data sources state â”€â”€

  if (!dsLoading && dataSources.length === 0) {
    return (
      <Card bordered style={{ borderColor: "#e2e8f0" }}>
        <Empty
          image={<DatabaseOutlined style={{ fontSize: 48, color: "#ddd" }} />}
          imageStyle={{ height: 60 }}
          description="No data sources connected yet. Connect a data source first to start querying."
        />
      </Card>
    );
  }

  // â”€â”€ Visualization view â”€â”€

  if (showViz && selectedDsId) {
    const ds = dataSources.find((d) => d.id === selectedDsId);
    return (
      <VisualizationBuilder
        dsId={selectedDsId}
        dsName={ds?.name || ""}
        sqlQuery={vizSql}
        columns={vizColumns}
        data={vizData}
        onBack={() => setShowViz(false)}
        onSaved={() => onNavigate?.("visualizations")}
      />
    );
  }

  // â”€â”€ Query Builder view â”€â”€

  if (showBuilder && selectedDsId && selectedTable && columns.length > 0) {
    const ds = dataSources.find((d) => d.id === selectedDsId);
    const isMongo = ds?.ds_type === "mongodb";

    if (isMongo) {
      return (
        <MongoQueryBuilder
          dsId={selectedDsId}
          dsName={ds?.name || ""}
          database={selectedTable.schema}
          collection={selectedTable.table}
          columns={columns}
          onBack={() => setShowBuilder(false)}
          onVisualize={(query, resultCols, resultData) => {
            setVizSql(query);
            setVizColumns(resultCols);
            setVizData(resultData);
            setShowViz(true);
          }}
        />
      );
    }

    return (
      <QueryBuilder
        dsId={selectedDsId}
        dsName={ds?.name || ""}
        schema={selectedTable.schema}
        table={selectedTable.table}
        columns={columns}
        onBack={() => setShowBuilder(false)}
        onVisualize={(sql, resultCols, resultData) => {
          setVizSql(sql);
          setVizColumns(resultCols);
          setVizData(resultData);
          setShowViz(true);
        }}
      />
    );
  }

  return (
    <div>
      {/* Header / Breadcrumb */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 4 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          New Query
        </Title>
        <Text type="secondary">
          Select a data source and {isMongo ? "collection" : "table"} to start building your query
        </Text>
      </div>

      {/* Step 1: Select data source */}
      <Card
        size="small"
        bordered
        style={{ borderColor: "#e2e8f0", marginBottom: 16 }}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={4}>
          <Text strong>Data Source</Text>
          <Select
            placeholder="Select a data source..."
            style={{ width: "100%", maxWidth: 500 }}
            loading={dsLoading}
            value={selectedDsId}
            onChange={(val) => {
              setSelectedDsId(val);
              setTableSearch("");
              setTablePage(1);
              const ds = dataSources.find((d) => d.id === val);
              if (ds) {
                track("datasource.selected", {
                  resourceType: "datasource",
                  resourceId: val,
                  metadata: { name: ds.name, ds_type: ds.ds_type },
                });
              }
            }}
            showSearch
            optionFilterProp="label"
            options={dataSources.map((ds) => ({
              value: ds.id,
              label: `${ds.name}  (${TYPE_LABELS[ds.ds_type] || ds.ds_type} â€” ${ds.host}:${ds.port}/${ds.database})`,
            }))}
          />
        </Space>
      </Card>

      {/* Step 2: Schema + Table browser */}
      {selectedDsId && (
        <Card
          size="small"
          bordered
          style={{ borderColor: "#e2e8f0", marginBottom: 16 }}
          loading={schemasLoading}
        >
          <div
            style={{
              display: "flex",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            {/* Schema selector */}
            <div style={{ minWidth: 200 }}>
              <Text strong style={{ display: "block", marginBottom: 4 }}>
                {isMongo ? "Database" : "Schema"}
              </Text>
              <Select
                placeholder={isMongo ? "Select database..." : "Select schema..."}
                style={{ width: 240 }}
                value={selectedSchema}
                onChange={(val) => {
                  setSelectedSchema(val);
                  setTableSearch("");
                  setTablePage(1);
                  setSelectedTable(null);
                  setColumns([]);
                }}
                options={schemas.map((s) => ({
                  value: s.schema_name,
                  label: s.schema_name,
                }))}
                showSearch
                optionFilterProp="label"
              />
            </div>

            {/* Table search */}
            {selectedSchema && (
              <div style={{ flex: 1, minWidth: 200 }}>
                <Text strong style={{ display: "block", marginBottom: 4 }}>
                  {isMongo ? "Search Collections" : "Search Tables"}
                </Text>
                <Input
                  placeholder={isMongo ? "Filter collections..." : "Filter tables..."}
                  prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                  allowClear
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  style={{ maxWidth: 360 }}
                />
              </div>
            )}
          </div>

          {selectedSchema && (
            <>
              {/* Tables list â€” full width */}
              <div style={{ marginBottom: 8 }}>
                <Badge
                  count={tablesTotal}
                  overflowCount={9999}
                  style={{ backgroundColor: "#e2e8f0", color: "#666" }}
                />
                <Text
                  type="secondary"
                  style={{ marginLeft: 8, fontSize: 12 }}
                >
                  {isMongo ? "collections found" : "tables found"}
                </Text>
              </div>
              <Table
                dataSource={tables}
                columns={tableColumns}
                rowKey={(r) => `${r.schema_name}.${r.table_name}`}
                loading={tablesLoading}
                size="small"
                pagination={{
                  current: tablePage,
                  pageSize: tablePageSize,
                  total: tablesTotal,
                  showSizeChanger: true,
                  pageSizeOptions: ["10", "20", "50", "100"],
                  showTotal: (total) => `${total} ${isMongo ? "collections" : "tables"}`,
                  onChange: (page, size) => {
                    setTablePage(page);
                    setTablePageSize(size);
                  },
                }}
                onRow={(record) => ({
                  onClick: () =>
                    handleTableSelect(record.schema_name, record.table_name),
                  style: { cursor: "pointer" },
                })}
                rowClassName={(record) =>
                  selectedTable?.schema === record.schema_name &&
                  selectedTable?.table === record.table_name
                    ? "queries-table-row-selected"
                    : ""
                }
              />
            </>
          )}
        </Card>
      )}

      {/* Column preview â€” separate card below */}
      {selectedTable && (
        <Card
          size="small"
          bordered
          style={{ borderColor: "#e2e8f0" }}
          title={
            <Space>
              <TableOutlined />
              <Breadcrumb
                style={{ fontSize: 13 }}
                items={[
                  { title: selectedDs?.name },
                  { title: selectedTable.schema },
                  { title: <Text strong>{selectedTable.table}</Text> },
                ]}
              />
            </Space>
          }
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              {columns.length} {isMongo ? "field" : "column"}{columns.length !== 1 ? "s" : ""}
            </Text>
          }
        >
          <Table
            dataSource={columns}
            columns={columnTableColumns}
            rowKey="column_name"
            loading={columnsLoading}
            size="small"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50"],
              showTotal: (total) => `${total} ${isMongo ? "fields" : "columns"}`,
            }}
          />
        </Card>
      )}

      {/* Build Query button */}
      {selectedTable && columns.length > 0 && (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <Button
            type="primary"
            size="large"
            icon={<FileTextOutlined />}
            onClick={() => setShowBuilder(true)}
          >
            Build Query
          </Button>
        </div>
      )}
    </div>
  );
}
