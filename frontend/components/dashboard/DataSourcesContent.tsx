"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Popconfirm,
  Typography,
  App,
  Empty,
} from "antd";
import {
  DatabaseOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { listDataSourcesAction, deleteDataSourceAction } from "@/lib/actions";
import ConnectDataSourceModal from "./ConnectDataSourceModal";

const { Text } = Typography;

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

export default function DataSourcesContent() {
  const { message } = App.useApp();
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchDataSources = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listDataSourcesAction();
      if (result.ok && result.data) {
        setDataSources(result.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDataSources();
  }, [fetchDataSources]);

  const handleDelete = async (dsId: string) => {
    const result = await deleteDataSourceAction(dsId);
    if (result.ok) {
      message.success("Data source deleted");
      fetchDataSources();
    } else {
      message.error(result.error || "Failed to delete");
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Type",
      dataIndex: "ds_type",
      key: "ds_type",
      render: (type: string) => (
        <Tag color={TYPE_COLORS[type] || "default"}>
          {TYPE_LABELS[type] || type}
        </Tag>
      ),
    },
    {
      title: "Host",
      key: "host",
      render: (_: unknown, record: DataSource) =>
        `${record.host}:${record.port}`,
    },
    {
      title: "Database",
      dataIndex: "database",
      key: "database",
    },
    {
      title: "Username",
      dataIndex: "username",
      key: "username",
    },
    {
      title: "Added",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: "",
      key: "actions",
      width: 60,
      render: (_: unknown, record: DataSource) => (
        <Popconfirm
          title="Delete data source"
          description={`Remove "${record.name}"? This cannot be undone.`}
          onConfirm={() => handleDelete(record.id)}
          okText="Delete"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <Card
        title="Data Sources"
        bordered
        style={{ borderColor: "#e2e8f0" }}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            Connect Data Source
          </Button>
        }
      >
        {dataSources.length === 0 && !loading ? (
          <Empty
            image={<DatabaseOutlined style={{ fontSize: 48, color: "#ddd" }} />}
            imageStyle={{ height: 60 }}
            description="No data sources connected yet"
          >
            <Button type="primary" onClick={() => setModalOpen(true)}>
              Connect Your First Data Source
            </Button>
          </Empty>
        ) : (
          <Table
            dataSource={dataSources}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `${total} data source${total !== 1 ? "s" : ""}`,
            }}
          />
        )}
      </Card>

      <ConnectDataSourceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          message.success("Data source connected successfully!");
          fetchDataSources();
        }}
      />
    </>
  );
}
