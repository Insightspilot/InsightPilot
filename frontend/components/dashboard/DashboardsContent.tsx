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
  Spin,
} from "antd";
import {
  AppstoreOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  LockOutlined,
  GlobalOutlined,
  ShareAltOutlined,
  SearchOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import {
  listDashboardsAction,
  getDashboardAction,
  deleteDashboardAction,
  shareDashboardAction,
  removeDashboardShareAction,
  listMembersAction,
  getCurrentUserIdAction,
  checkDashboardVizAccessAction,
} from "@/lib/actions";
import type { DashboardListItem, DashboardDetail, DashboardShareInfo, VizAccessItem } from "@/lib/actions";
import DashboardBuilder from "./DashboardBuilder";
import DashboardViewer from "./DashboardViewer";

const { Text, Title } = Typography;

type View = "list" | "create" | "edit" | "view";

export default function DashboardsContent() {
  const { message, modal } = App.useApp();

  const [dashList, setDashList] = useState<DashboardListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [tab, setTab] = useState<"mine" | "shared">("mine");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // View state
  const [view, setView] = useState<View>("list");
  const [editingDash, setEditingDash] = useState<DashboardDetail | null>(null);
  const [viewingDash, setViewingDash] = useState<DashboardDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Share state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharingDashId, setSharingDashId] = useState<string | null>(null);
  const [sharingDash, setSharingDash] = useState<DashboardDetail | null>(null);
  const [orgMembers, setOrgMembers] = useState<
    { id: string; email: string; full_name: string }[]
  >([]);
  const [selectedShareUsers, setSelectedShareUsers] = useState<string[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [vizAccessWarnings, setVizAccessWarnings] = useState<VizAccessItem[]>([]);
  const [shareTab, setShareTab] = useState<"add" | "manage">("add");
  const [shareSearch, setShareSearch] = useState("");

  const fetchList = async () => {
    setLoading(true);
    try {
      const result = await listDashboardsAction();
      if (result.ok && result.data) {
        setDashList(result.data);
      } else {
        message.error(result.error || "Failed to load dashboards");
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
    if (!currentUserId) return [];
    let list = dashList;
    if (tab === "mine") {
      list = list.filter((d) => d.created_by === currentUserId);
    } else {
      list = list.filter((d) => d.created_by !== currentUserId);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.description || "").toLowerCase().includes(q) ||
          d.creator_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [dashList, debouncedSearch, tab, currentUserId]);

  const handleEdit = async (dashId: string) => {
    setDetailLoading(true);
    try {
      const result = await getDashboardAction(dashId);
      if (result.ok && result.data) {
        setEditingDash(result.data);
        setView("edit");
      } else {
        message.error(result.error || "Failed to load dashboard");
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleView = async (dashId: string) => {
    setDetailLoading(true);
    try {
      const result = await getDashboardAction(dashId);
      if (result.ok && result.data) {
        setViewingDash(result.data);
        setView("view");
      } else {
        message.error(result.error || "Failed to load dashboard");
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = (dashId: string, title: string) => {
    modal.confirm({
      title: "Delete Dashboard",
      content: `Are you sure you want to delete "${title}"?`,
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        const result = await deleteDashboardAction(dashId);
        if (result.ok) {
          message.success("Deleted");
          fetchList();
        } else {
          message.error(result.error || "Failed to delete");
        }
      },
    });
  };

  const handleOpenShare = async (dashId: string) => {
    setSharingDashId(dashId);
    setSharingDash(null);
    setVizAccessWarnings([]);
    setSelectedShareUsers([]);
    setShareLoading(true);
    try {
      const [membersResult, dashResult] = await Promise.all([
        listMembersAction(),
        getDashboardAction(dashId),
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
      if (dashResult.ok && dashResult.data) {
        setSharingDash(dashResult.data);
      }
    } finally {
      setShareLoading(false);
    }
    setShareModalOpen(true);
  };

  const doShare = async () => {
    if (!sharingDashId) return;
    setShareLoading(true);
    try {
      const result = await shareDashboardAction(
        sharingDashId,
        selectedShareUsers
      );
      if (result.ok) {
        message.success("Shared successfully!");
        setShareModalOpen(false);
        setSelectedShareUsers([]);
        setVizAccessWarnings([]);
      } else {
        message.error(result.error || "Failed to share");
      }
    } finally {
      setShareLoading(false);
    }
  };

  const handleRemoveShare = async (userId: string) => {
    if (!sharingDashId) return;
    setShareLoading(true);
    try {
      const result = await removeDashboardShareAction(sharingDashId, userId);
      if (result.ok) {
        message.success("Access removed");
        // Refresh the dashboard detail to update shared_with
        const dashResult = await getDashboardAction(sharingDashId);
        if (dashResult.ok && dashResult.data) {
          setSharingDash(dashResult.data);
        }
      } else {
        message.error(result.error || "Failed to remove access");
      }
    } finally {
      setShareLoading(false);
    }
  };

  const handleShare = async () => {
    if (!sharingDashId || selectedShareUsers.length === 0) return;
    setShareLoading(true);
    try {
      const accessResult = await checkDashboardVizAccessAction(
        sharingDashId,
        selectedShareUsers
      );
      if (accessResult.ok && accessResult.data && accessResult.data.length > 0) {
        setVizAccessWarnings(accessResult.data);
        setShareLoading(false);
        // Show confirmation â€” don't share yet
        return;
      }
      // No access issues â€” share directly
      await doShare();
    } catch {
      setShareLoading(false);
    }
  };

  const backToList = () => {
    setView("list");
    setEditingDash(null);
    setViewingDash(null);
    fetchList();
  };

  // â”€â”€ Builder / Viewer views â”€â”€
  if (view === "create") {
    return (
      <DashboardBuilder
        onBack={backToList}
        onSaved={backToList}
      />
    );
  }
  if (view === "edit" && editingDash) {
    return (
      <DashboardBuilder
        editingDashboard={editingDash}
        onBack={backToList}
        onSaved={backToList}
      />
    );
  }
  if (view === "view" && viewingDash) {
    return (
      <DashboardViewer
        dashboard={viewingDash}
        onBack={backToList}
      />
    );
  }

  // â”€â”€ List view â”€â”€
  const columns = [
    {
      title: "Title",
      key: "title",
      render: (_: unknown, record: DashboardListItem) => (
        <Space>
          <AppstoreOutlined style={{ color: "#4F6CF7" }} />
          <Text strong>{record.title}</Text>
        </Space>
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
      render: (_: unknown, record: DashboardListItem) => (
        <Space>
          <Tooltip title="View">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleView(record.id)}
            />
          </Tooltip>
          {currentUserId && record.created_by === currentUserId && (
            <Tooltip title="Edit">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
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
      {detailLoading && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.6)" }}>
          <Spin size="large" />
        </div>
      )}

      <div
        style={{
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>
            <AppstoreOutlined style={{ marginRight: 8 }} />
            Dashboards
          </Title>
          <Text type="secondary">
            Create and manage dashboards to organize your visualizations
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setView("create")}
        >
          Create Dashboard
        </Button>
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
            placeholder="Search dashboards..."
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 300 }}
          />
          <div style={{ flex: 1 }} />
          <Tag color="blue">{filteredList.length} dashboards</Tag>
        </div>

        {filteredList.length === 0 && !loading ? (
          <Empty
            description={
              search
                ? "No dashboards match your search"
                : "No dashboards yet. Click 'Create Dashboard' to get started."
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
              showTotal: (total) => `${total} dashboards`,
            }}
          />
        )}
      </Card>

      {/* Share Modal */}
      <Modal
        title="Share Dashboard"
        open={shareModalOpen}
        width={520}
        onCancel={() => {
          setShareModalOpen(false);
          setSelectedShareUsers([]);
          setVizAccessWarnings([]);
          setShareTab("add");
          setShareSearch("");
        }}
        footer={shareTab === "add" ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => { setShareModalOpen(false); setSelectedShareUsers([]); setVizAccessWarnings([]); }}>
              Cancel
            </Button>
            <Button
              type="primary"
              loading={shareLoading}
              disabled={selectedShareUsers.length === 0}
              onClick={vizAccessWarnings.length > 0 ? doShare : handleShare}
            >
              {vizAccessWarnings.length > 0 ? "Share Anyway" : "Share"}
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
            { label: `Add Users`, value: "add" },
            { label: `Manage Access (${sharingDash?.shared_with.length || 0})`, value: "manage" },
          ]}
          block
          style={{ marginBottom: 16 }}
        />

        {shareTab === "add" ? (
          <>
            <Select
              mode="multiple"
              style={{ width: "100%" }}
              placeholder="Search and select users..."
              value={selectedShareUsers}
              onChange={(val) => {
                setSelectedShareUsers(val);
                setVizAccessWarnings([]);
              }}
              loading={shareLoading}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
              }
              options={orgMembers
                .filter((m) => {
                  if (m.id === currentUserId) return false;
                  if (sharingDash?.shared_with.some((s) => s.user_id === m.id)) return false;
                  if (m.id === sharingDash?.created_by) return false;
                  return true;
                })
                .map((m) => ({
                  value: m.id,
                  label: `${m.full_name} (${m.email})`,
                }))}
              showSearch
              notFoundContent="No users found"
            />
            {vizAccessWarnings.length > 0 && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 16px",
                  background: "#fffbe6",
                  border: "1px solid #ffe58f",
                  borderRadius: 8,
                }}
              >
                <Text strong style={{ color: "#d48806", display: "block", marginBottom: 8 }}>
                  âš  Some users don&apos;t have access to visualizations in this dashboard
                </Text>
                <Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
                  They will still be able to see these visualizations through this shared dashboard.
                </Text>
                {vizAccessWarnings.map((w) => (
                  <div key={w.user_id} style={{ marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 13 }}>{w.user_name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}> cannot directly access: </Text>
                    <Text style={{ fontSize: 12 }}>
                      {w.inaccessible_vizs.map((v) => v.title).join(", ")}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {(sharingDash?.shared_with.length || 0) > 5 && (
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
                const filtered = (sharingDash?.shared_with || []).filter(
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
                      onClick={() => handleRemoveShare(s.user_id)}
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
