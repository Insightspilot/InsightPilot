"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Button,
  Space,
  Alert,
  Steps,
  Typography,
  Row,
  Col,
  Card,
  Segmented,
  Spin,
  Switch,
} from "antd";
import {
  DatabaseOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
  LockOutlined,
} from "@ant-design/icons";
import {
  getDataSourceCatalogAction,
  testDataSourceConnectionAction,
  createDataSourceAction,
} from "@/lib/actions";
import type { CatalogItem } from "@/lib/actions";
import { useActivityTracker } from "@/components/providers/useActivityTracker";

const { Text } = Typography;

/* ------------------------------------------------------------------ */
/* Icon map â€“ maps the `icon` key from the catalog to inline SVG      */
/* ------------------------------------------------------------------ */
const DS_ICONS: Record<string, React.ReactNode> = {
  postgresql: (
    <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
      <rect width="36" height="36" rx="8" fill="#336791" />
      <text x="18" y="23" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="700" fontFamily="sans-serif">P</text>
    </svg>
  ),
  mysql: (
    <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
      <rect width="36" height="36" rx="8" fill="#00758F" />
      <text x="18" y="23" textAnchor="middle" fill="#F29111" fontSize="13" fontWeight="700" fontFamily="sans-serif">My</text>
    </svg>
  ),
  mssql: (
    <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
      <rect width="36" height="36" rx="8" fill="#CC2927" />
      <text x="18" y="23" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" fontFamily="sans-serif">SQL</text>
    </svg>
  ),
  mongodb: (
    <svg viewBox="0 0 36 36" width="36" height="36" fill="none">
      <rect width="36" height="36" rx="8" fill="#00684A" />
      <text x="18" y="23" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" fontFamily="sans-serif">MDB</text>
    </svg>
  ),
};

const FALLBACK_ICON = <DatabaseOutlined style={{ fontSize: 28, color: "#999" }} />;

/* ------------------------------------------------------------------ */

interface ConnectDataSourceModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

type TestStatus = "idle" | "testing" | "success" | "error";

export default function ConnectDataSourceModal({
  open,
  onClose,
  onCreated,
}: ConnectDataSourceModalProps) {
  const [form] = Form.useForm();
  const { track } = useActivityTracker();
  const [step, setStep] = useState(0);

  // Catalog
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<CatalogItem | null>(null);

  // Connection
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [connValues, setConnValues] = useState<Record<string, any>>({});

  // Save
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Fetch catalog on first open
  useEffect(() => {
    if (open && catalog.length === 0) {
      setCatalogLoading(true);
      getDataSourceCatalogAction().then((res) => {
        if (res.ok && res.data) setCatalog(res.data);
        setCatalogLoading(false);
      });
    }
  }, [open, catalog.length]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(catalog.map((c) => c.category)));
    return ["all", ...cats];
  }, [catalog]);

  const categoryLabels: Record<string, string> = {
    all: "All",
    sql: "SQL Databases",
    nosql: "NoSQL",
  };

  const filteredCatalog = useMemo(() => {
    let items = catalog;
    if (categoryFilter !== "all") {
      items = items.filter((c) => c.category === categoryFilter);
    }
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase();
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }
    return items;
  }, [catalog, categoryFilter, catalogSearch]);

  const resetAll = () => {
    form.resetFields();
    setStep(0);
    setSelectedType(null);
    setCatalogSearch("");
    setCategoryFilter("all");
    setTestStatus("idle");
    setTestMessage("");
    setConnValues({});
    setSaving(false);
    setSaveError("");
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const handleSelectType = (item: CatalogItem) => {
    setSelectedType(item);
    form.setFieldsValue({ port: item.default_port });
    setStep(1);
  };

  const handleTestConnection = async () => {
    try {
      await form.validateFields(["host", "port", "database", "username", "password"]);
    } catch {
      return;
    }

    const values = form.getFieldsValue();
    setTestStatus("testing");
    setTestMessage("");

    const result = await testDataSourceConnectionAction({
      ds_type: selectedType!.key as "postgresql" | "mysql" | "mssql" | "mongodb",
      host: values.host,
      port: values.port,
      database: values.database,
      username: values.username,
      password: values.password,
      use_ssl: values.use_ssl ?? false,
    });

    if (result.ok && result.data?.success) {
      setTestStatus("success");
      setTestMessage(result.data.message);
    } else {
      setTestStatus("error");
      setTestMessage(result.data?.message || result.error || "Connection failed");
    }
  };

  const handleNextToSave = async () => {
    try {
      await form.validateFields(["host", "port", "database", "username", "password"]);
      setConnValues(form.getFieldsValue());
      setStep(2);
    } catch {
      return;
    }
  };

  const handleSave = async () => {
    try {
      await form.validateFields(["name"]);
    } catch {
      return;
    }

    setSaving(true);
    setSaveError("");

    const values = form.getFieldsValue();
    const result = await createDataSourceAction({
      name: values.name,
      ds_type: selectedType!.key as "postgresql" | "mysql" | "mssql" | "mongodb",
      host: connValues.host,
      port: connValues.port,
      database: connValues.database,
      username: connValues.username,
      password: connValues.password,
      use_ssl: connValues.use_ssl ?? false,
    });

    if (result.ok) {
      track("datasource.connected", {
        resourceType: "datasource",
        metadata: { name: values.name, ds_type: selectedType!.key, host: connValues.host },
      });
      handleClose();
      onCreated();
    } else {
      setSaveError(result.error || "Failed to save data source");
    }
    setSaving(false);
  };

  const stepTitle =
    step === 0
      ? "Select Data Source"
      : step === 1
      ? `Connect to ${selectedType?.name ?? ""}`
      : "Name & Save";

  return (
    <Modal
      title={
        <Space>
          <DatabaseOutlined />
          {stepTitle}
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={step === 0 ? 780 : 640}
      footer={null}
      destroyOnClose
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: "Select Type" },
          { title: "Connection" },
          { title: "Name & Save" },
        ]}
      />

      {/* -------- Step 0: Catalog selector -------- */}
      {step === 0 && (
        <>
          <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }} size={12}>
            <Input
              placeholder="Search data sources..."
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              allowClear
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              style={{ borderRadius: 6 }}
            />
            {categories.length > 2 && (
              <Segmented
                value={categoryFilter}
                onChange={(val) => setCategoryFilter(val as string)}
                options={categories.map((c) => ({
                  label: categoryLabels[c] || c.toUpperCase(),
                  value: c,
                }))}
              />
            )}
          </Space>

          {catalogLoading ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <Spin size="large" />
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "#999" }}>
              No data sources match your search
            </div>
          ) : (
            <Row gutter={[12, 12]}>
              {filteredCatalog.map((item) => (
                <Col xs={24} sm={12} key={item.key}>
                  <Card
                    hoverable
                    style={{
                      borderColor: "#e2e8f0",
                      cursor: "pointer",
                      transition: "border-color 0.2s",
                    }}
                    styles={{ body: { padding: 16 } }}
                    onClick={() => handleSelectType(item)}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#2563EB";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
                    }}
                  >
                    <Space align="start" size={12}>
                      <div
                        style={{
                          flexShrink: 0,
                          width: 40,
                          height: 40,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {DS_ICONS[item.icon] || FALLBACK_ICON}
                      </div>
                      <div>
                        <Text strong style={{ fontSize: 15 }}>
                          {item.name}
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.description}
                        </Text>
                      </div>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </>
      )}

      <Form form={form} layout="vertical" requiredMark={false} preserve>
      {/* -------- Step 1: Connection details -------- */}
      {step === 1 && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 20,
              padding: "10px 14px",
              background: "#f8fafc",
              borderRadius: 8,
              border: "1px solid #f0f0f0",
            }}
          >
            <div style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {DS_ICONS[selectedType?.icon ?? ""] || FALLBACK_ICON}
            </div>
            <div>
              <Text strong>{selectedType?.name}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Default port {selectedType?.default_port}
              </Text>
            </div>
          </div>

          <Space.Compact style={{ width: "100%" }}>
            <Form.Item
              name="host"
              label="Host"
              rules={[{ required: true, message: "Required" }]}
              style={{ flex: 1 }}
            >
              <Input size="large" placeholder="localhost or IP" />
            </Form.Item>
            <Form.Item
              name="port"
              label="Port"
              rules={[{ required: true, message: "Required" }]}
              style={{ width: 120 }}
            >
              <InputNumber size="large" min={1} max={65535} style={{ width: "100%" }} />
            </Form.Item>
          </Space.Compact>

          <Form.Item
            name="database"
            label="Database Name"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input size="large" placeholder="my_database" />
          </Form.Item>

          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input size="large" placeholder="db_user" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: "Required" }]}
          >
            <Input.Password size="large" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" />
          </Form.Item>

          <Form.Item
            name="use_ssl"
            label={
              <Space size={6}>
                <LockOutlined />
                <span>Use SSL / TLS</span>
              </Space>
            }
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>

          {testStatus === "success" && (
            <Alert
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              message="Connection successful"
              description={testMessage}
              style={{ marginBottom: 16 }}
            />
          )}
          {testStatus === "error" && (
            <Alert
              type="error"
              showIcon
              icon={<CloseCircleOutlined />}
              message="Connection failed"
              description={testMessage}
              style={{ marginBottom: 16 }}
            />
          )}

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => {
                  setStep(0);
                  setTestStatus("idle");
                  setTestMessage("");
                }}
              >
                Back
              </Button>
              <Button
                onClick={handleTestConnection}
                loading={testStatus === "testing"}
                icon={
                  testStatus === "success" ? (
                    <CheckCircleOutlined style={{ color: "#52c41a" }} />
                  ) : undefined
                }
              >
                Test Connection
              </Button>
            </Space>
            <Button type="primary" onClick={handleNextToSave}>
              Next
            </Button>
          </div>
        </>
      )}

      {/* -------- Step 2: Name & Save -------- */}
      {step === 2 && (
        <>
          <div
            style={{
              background: "#f8fafc",
              borderRadius: 8,
              padding: 16,
              marginBottom: 20,
              border: "1px solid #f0f0f0",
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              Connection Summary
            </Text>
            <div style={{ marginTop: 8 }}>
              <Space size={8} align="center">
                <div style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {DS_ICONS[selectedType?.icon ?? ""] || FALLBACK_ICON}
                </div>
                <Text strong>{selectedType?.name}</Text>
              </Space>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary">
                  {connValues.username}@{connValues.host}:
                  {connValues.port}/{connValues.database}
                  {connValues.use_ssl && " (SSL)"}
                </Text>
              </div>
            </div>
          </div>

          <Form.Item
            name="name"
            label="Display Name"
            rules={[{ required: true, message: "Give this data source a name" }]}
          >
            <Input size="large" placeholder="e.g. Production DB, Analytics Warehouse" />
          </Form.Item>

          {saveError && (
            <Alert type="error" message={saveError} showIcon style={{ marginBottom: 16 }} />
          )}

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="primary" onClick={handleSave} loading={saving}>
              Save Data Source
            </Button>
          </div>
        </>
      )}
      </Form>
    </Modal>
  );
}
