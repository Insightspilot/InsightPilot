"use client";

import { useState, useEffect, useMemo } from "react";
import { useDebouncedValue } from "@/lib/hooks";
import {
  Card,
  Table,
  Tag,
  Typography,
  Space,
  Button,
  Empty,
  App,
  Modal,
  Tooltip,
  Input,
  Select,
  Segmented,
} from "antd";
import {
  PieChartOutlined,
  BarChartOutlined,
  LineChartOutlined,
  TableOutlined,
  AreaChartOutlined,
  DotChartOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  LockOutlined,
  GlobalOutlined,
  ShareAltOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  listVisualizationsAction,
  getVisualizationAction,
  deleteVisualizationAction,
  shareVisualizationAction,
  removeShareAction,
  listMembersAction,
  getCurrentUserIdAction,
  executeQueryAction,
} from "@/lib/actions";
import type { VisualizationListItem, VisualizationDetail, VisualizationShareInfo } from "@/lib/actions";
import VisualizationViewer from "./VisualizationViewer";
import VisualizationBuilder from "./VisualizationBuilder";

const { Text, Title } = Typography;

const CHART_ICONS: Record<string, React.ReactNode> = {
  table: <TableOutlined />,
  bar: <BarChartOutlined />,
  line: <LineChartOutlined />,
  pie: <PieChartOutlined />,
  area: <AreaChartOutlined />,
  scatter: <DotChartOutlined />,
};

export default function VisualizationsContent() {
  const { message, modal } = App.useApp();

  const [vizList, setVizList] = useState<VisualizationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [tab, setTab] = useState<"mine" | "shared">("mine");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Viewer state
  const [viewingViz, setViewingViz] = useState<VisualizationDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Edit state
  const [editingViz, setEditingViz] = useState<VisualizationDetail | null>(null);
  const [editColumns, setEditColumns] = useState<string[]>([]);
  const [editData, setEditData] = useState<unknown[][]>([]);
  const [editLoading, setEditLoading] = useState(false);

  // Share state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharingVizId, setSharingVizId] = useState<string | null>(null);
  const [sharingViz, setSharingViz] = useState<VisualizationDetail | null>(null);
  const [orgMembers, setOrgMembers] = useState<
    { id: string; email: string; full_name: string }[]
  >([]);
  const [selectedShareUsers, setSelectedShareUsers] = useState<string[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareTab, setShareTab] = useState<"add" | "manage">("add");
  const [shareSearch, setShareSearch] = useState("");

  const fetchList = async () => {
    setLoading(true);
    try {
      const result = await listVisualizationsAction();
      if (result.ok && result.data) {
        setVizList(result.data);
      } else {
        message.error(result.error || "Failed to load visualizations");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
    getCurrentUserIdAction().then(setCurrentUserId);
  }, []);

  const filteredList = useMemo(() => {
    // Wait until we know the current user before filtering
    if (!currentUserId) return [];
    let list = vizList;
    // Filter by tab
    if (tab === "mine") {
      list = list.filter((v) => v.created_by === currentUserId);
    } else {
      list = list.filter((v) => v.created_by !== currentUserId);
    }
    // Filter by search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          (v.description || "").toLowerCase().includes(q) ||
          v.chart_type.toLowerCase().includes(q) ||
          v.creator_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [vizList, debouncedSearch, tab, currentUserId]);

  const handleView = async (vizId: string) => {
    setViewLoading(true);
    try {
      const result = await getVisualizationAction(vizId);
      if (result.ok && result.data) {
        setViewingViz(result.data);
      } else {
        message.error(result.error || "Failed to load visualization");
      }
    } finally {
      setViewLoading(false);
    }
  };

  const handleDelete = (vizId: string, title: string) => {
    modal.confirm({
      title: "Delete Visualization",
      content: `Are you sure you want to delete "${title}"?`,
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        const result = await deleteVisualizationAction(vizId);
        if (result.ok) {
          message.success("Deleted");
          fetchList();
        } else {
          message.error(result.error || "Failed to delete");
        }
      },
    });
  };

  const handleOpenShare = async (vizId: string) => {
    setSharingVizId(vizId);
    setSharingViz(null);
    setSelectedShareUsers([]);
    setShareTab("add");
    setShareSearch("");
    setShareLoading(true);
    try {
      const [membersResult, vizResult] = await Promise.all([
        listMembersAction(),
        getVisualizationAction(vizId),
      ]);
      if (membersResult.ok && membersResult.data) {
        setOrgMembers(
          membersResult.data.map((m) => ({
            id: m.user_id,
            email: m.email,
            full_name: m.full_name,
          }))
        );
      }
      if (vizResult.ok && vizResult.data) {
        setSharingViz(vizResult.data);
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

  const handleRemoveVizShare = async (userId: string) => {
    if (!sharingVizId) return;
    setShareLoading(true);
    try {
      const result = await removeShareAction(sharingVizId, userId);
      if (result.ok) {
        message.success("Access removed");
        const vizResult = await getVisualizationAction(sharingVizId);
        if (vizResult.ok && vizResult.data) {
          setSharingViz(vizResult.data);
        }
      } else {
        message.error(result.error || "Failed to remove access");
      }
    } finally {
      setShareLoading(false);
    }
  };

  const handleEdit = async (vizId: string) => {
    setEditLoading(true);
    try {
      const vizResult = await getVisualizationAction(vizId);
      if (!vizResult.ok || !vizResult.data) {
        message.error(vizResult.error || "Failed to load visualization");
        return;
      }
      const viz = vizResult.data;
      // Execute the query to get fresh columns/data
      const queryResult = await executeQueryAction(viz.ds_id, viz.sql_query, 1000);
      if (!queryResult.ok || !queryResult.data) {
        message.error(queryResult.error || "Failed to execute query");
        return;
      }
      setEditColumns(queryResult.data.columns);
      setEditData(queryResult.data.rows);
      setEditingViz(viz);
    } finally {
      setEditLoading(false);
    }
  };

  // If editing a viz
  if (editingViz) {
    return (
      <VisualizationBuilder
        dsId={editingViz.ds_id}
        dsName=""
        sqlQuery={editingViz.sql_query}
        columns={editColumns}
        data={editData}
        editingViz={editingViz}
        onBack={() => {
          setEditingViz(null);
          fetchList();
        }}
        onSaved={() => {
          setEditingViz(null);
          fetchList();
        }}
      />
    );
  }

  // If viewing a specific viz
  if (viewingViz) {
    return (
      <VisualizationViewer
        viz={viewingViz}
        onBack={() => setViewingViz(null)}
      />
    );
  }

  const columns = [
    {
      title: "Title",
      key: "title",
      render: (_: unknown, record: VisualizationListItem) => (
        <Space>
          {CHART_ICONS[record.chart_type] || <BarChartOutlined />}
          <Text strong>{record.title}</Text>
        </Space>
      ),
    },
    {
      title: "Type",
      dataIndex: "chart_type",
      key: "chart_type",
      width: 100,
      render: (type: string) => (
        <Tag style={{ textTransform: "capitalize" }}>{type}</Tag>
      ),
    },
    {
      title: "Visibility",
      dataIndex: "visibility",
      key: "visibility",
      width: 110,
      render: (vis: string) =>
        vis === "public" ? (
          <Tag color="green" icon={<GlobalOutlined />}>
            Public
          </Tag>
        ) : (
          <Tag icon={<LockOutlined />}>Private</Tag>
        ),
    },
    {
      title: "Created By",
      dataIndex: "creator_name",
      key: "creator_name",
      width: 160,
    },
    {
      title: "Updated",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 160,
      render: (val: string) =>
        new Date(val).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      title: "Actions",
      key: "actions",
      width: 180,
      render: (_: unknown, record: VisualizationListItem) => (
        <Space>
          <Tooltip title="View">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              loading={viewLoading}
              onClick={() => handleView(record.id)}
            />
          </Tooltip>
          {currentUserId && record.created_by === currentUserId && (
            <Tooltip title="Edit">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                loading={editLoading}
                onClick={() => handleEdit(record.id)}
              />
            </Tooltip>
          )}
          {currentUserId && record.created_by === currentUserId && (
            <Tooltip title="Share">
              <Button
                type="text"
                size="small"
                icon={<ShareAltOutlined />}
                onClick={() => handleOpenShare(record.id)}
              />
            </Tooltip>
          )}
          {currentUserId && record.created_by === currentUserId && (
            <Tooltip title="Delete">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record.id, record.title)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 4 }}>
          <PieChartOutlined style={{ marginRight: 8 }} />
          Visualizations
        </Title>
        <Text type="secondary">
          View and manage your saved charts and tables
        </Text>
      </div>

      <Card size="small" bordered style={{ borderColor: "#e2e8f0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Segmented
            value={tab}
            onChange={(val) => setTab(val as "mine" | "shared")}
            options={[
              { label: "Yours", value: "mine" },
              { label: "Shared with you", value: "shared" },
            ]}
          />
          <Input
            placeholder="Search visualizations..."
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 300 }}
          />
          <div style={{ flex: 1 }} />
          <Tag color="blue">{filteredList.length} visualizations</Tag>
        </div>

        {filteredList.length === 0 && !loading ? (
          <Empty
            description={
              search
                ? "No visualizations match your search"
                : "No visualizations yet. Run a query and click Visualize to create one."
            }
          />
        ) : (
          <Table
            dataSource={filteredList}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50"],
              showTotal: (total) => `${total} visualizations`,
            }}
          />
        )}
      </Card>

      {/* Share Modal */}
      <Modal
        title="Share Visualization"
        open={shareModalOpen}
        width={520}
        onCancel={() => {
          setShareModalOpen(false);
          setSelectedShareUsers([]);
          setShareTab("add");
          setShareSearch("");
        }}
        footer={shareTab === "add" ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => { setShareModalOpen(false); setSelectedShareUsers([]); }}>
              Cancel
            </Button>
            <Button
              type="primary"
              loading={shareLoading}
              disabled={selectedShareUsers.length === 0}
              onClick={handleShare}
            >
              Share
            </Button>
          </div>
        ) : (
          <Button onClick={() => { setShareModalOpen(false); setShareSearch(""); }}>Close</Button>
        )}
      >
        <Segmented
          value={shareTab}
          onChange={(val) => { setShareTab(val as "add" | "manage"); setShareSearch(""); }}
          options={[
            { label: "Add Users", value: "add" },
            { label: `Manage Access (${sharingViz?.shared_with.length || 0})`, value: "manage" },
          ]}
          block
          style={{ marginBottom: 16 }}
        />

        {shareTab === "add" ? (
          <Select
            mode="multiple"
            style={{ width: "100%" }}
            placeholder="Search and select users..."
            value={selectedShareUsers}
            onChange={setSelectedShareUsers}
            loading={shareLoading}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
            }
            options={orgMembers
              .filter((m) => {
                if (m.id === currentUserId) return false;
                if (sharingViz?.shared_with.some((s) => s.user_id === m.id)) return false;
                if (m.id === sharingViz?.created_by) return false;
                return true;
              })
              .map((m) => ({
                value: m.id,
                label: `${m.full_name} (${m.email})`,
              }))}
            showSearch
            notFoundContent="No users found"
          />
        ) : (
          <>
            {(sharingViz?.shared_with.length || 0) > 5 && (
              <Input
                placeholder="Search shared users..."
                prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                allowClear
                value={shareSearch}
                onChange={(e) => setShareSearch(e.target.value)}
                style={{ marginBottom: 12 }}
              />
            )}
            <div style={{ maxHeight: 350, overflowY: "auto" }}>
              {(() => {
                const filtered = (sharingViz?.shared_with || []).filter(
                  (s) =>
                    !shareSearch ||
                    s.user_name.toLowerCase().includes(shareSearch.toLowerCase()) ||
                    s.user_email.toLowerCase().includes(shareSearch.toLowerCase())
                );
                if (filtered.length === 0) {
                  return (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={shareSearch ? "No matching users" : "Not shared with anyone yet"}
                    />
                  );
                }
                return filtered.map((s) => (
                  <div
                    key={s.user_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderBottom: "1px solid #f0f0f0",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Text ellipsis style={{ fontSize: 13, display: "block" }}>{s.user_name}</Text>
                      <Text type="secondary" ellipsis style={{ fontSize: 12, display: "block" }}>{s.user_email}</Text>
                    </div>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      loading={shareLoading}
                      onClick={() => handleRemoveVizShare(s.user_id)}
                    >
                      Remove
                    </Button>
                  </div>
                ));
              })()}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
