"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useDebouncedValue } from "@/lib/hooks";
import {
  Card,
  Typography,
  Segmented,
  Input,
  Table,
  Tag,
  Button,
  Empty,
  App,
  Modal,
  Select,
  Spin,
} from "antd";
import {
  SearchOutlined,
  ShareAltOutlined,
  DeleteOutlined,
  BarChartOutlined,
  PieChartOutlined,
  LockOutlined,
  GlobalOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  listDashboardsAction,
  getDashboardAction,
  shareDashboardAction,
  removeDashboardShareAction,
  listVisualizationsAction,
  getVisualizationAction,
  shareVisualizationAction,
  removeShareAction,
  listMembersAction,
  getCurrentUserIdAction,
} from "@/lib/actions";
import type {
  DashboardListItem,
  DashboardDetail,
  DashboardShareInfo,
  VisualizationListItem,
  VisualizationDetail,
  VisualizationShareInfo,
} from "@/lib/actions";

const { Text, Title } = Typography;

type ResourceType = "dashboards" | "visualizations";
type ShareItem = { user_id: string; user_name: string; user_email: string };

export default function AccessManagement({ isOwnerOrAdmin = false }: { isOwnerOrAdmin?: boolean }) {
  const { message } = App.useApp();

  const [resourceType, setResourceType] = useState<ResourceType>("dashboards");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Dashboard state
  const [dashList, setDashList] = useState<DashboardListItem[]>([]);
  const [dashLoading, setDashLoading] = useState(false);

  // Visualization state
  const [vizList, setVizList] = useState<VisualizationListItem[]>([]);
  const [vizLoading, setVizLoading] = useState(false);

  // Share modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareModalTitle, setShareModalTitle] = useState("");
  const [sharingResourceId, setSharingResourceId] = useState<string | null>(null);
  const [sharingResourceType, setSharingResourceType] = useState<ResourceType>("dashboards");
  const [sharedWith, setSharedWith] = useState<ShareItem[]>([]);
  const [orgMembers, setOrgMembers] = useState<{ id: string; email: string; full_name: string }[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareTab, setShareTab] = useState<"add" | "manage">("add");
  const [shareSearch, setShareSearch] = useState("");
  const [createdBy, setCreatedBy] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUserIdAction().then((id) => setCurrentUserId(id));
  }, []);

  const fetchDashboards = useCallback(async () => {
    setDashLoading(true);
    try {
      const result = await listDashboardsAction();
      if (result.ok && result.data) setDashList(result.data);
    } finally {
      setDashLoading(false);
    }
  }, []);

  const fetchVisualizations = useCallback(async () => {
    setVizLoading(true);
    try {
      const result = await listVisualizationsAction();
      if (result.ok && result.data) setVizList(result.data);
    } finally {
      setVizLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboards();
    fetchVisualizations();
  }, [fetchDashboards, fetchVisualizations]);

  // Open share modal
  const handleOpenShare = async (id: string, title: string, type: ResourceType) => {
    setSharingResourceId(id);
    setSharingResourceType(type);
    setShareModalTitle(title);
    setSelectedUsers([]);
    setShareTab("add");
    setShareSearch("");
    setShareLoading(true);
    setShareModalOpen(true);

    try {
      const [membersResult, detailResult] = await Promise.all([
        listMembersAction(),
        type === "dashboards" ? getDashboardAction(id) : getVisualizationAction(id),
      ]);
      if (membersResult.ok && membersResult.data) {
        setOrgMembers(membersResult.data.map((m) => ({ id: m.user_id, email: m.email, full_name: m.full_name })));
      }
      if (detailResult.ok && detailResult.data) {
        const detail = detailResult.data as DashboardDetail | VisualizationDetail;
        setSharedWith(
          detail.shared_with.map((s) => ({ user_id: s.user_id, user_name: s.user_name, user_email: s.user_email }))
        );
        setCreatedBy(detail.created_by);
      }
    } finally {
      setShareLoading(false);
    }
  };

  const handleShare = async () => {
    if (!sharingResourceId || selectedUsers.length === 0) return;
    setShareLoading(true);
    try {
      const result = sharingResourceType === "dashboards"
        ? await shareDashboardAction(sharingResourceId, selectedUsers)
        : await shareVisualizationAction(sharingResourceId, selectedUsers);
      if (result.ok) {
        message.success("Shared successfully!");
        // Refresh shared_with
        const detailResult = sharingResourceType === "dashboards"
          ? await getDashboardAction(sharingResourceId)
          : await getVisualizationAction(sharingResourceId);
        if (detailResult.ok && detailResult.data) {
          const detail = detailResult.data as DashboardDetail | VisualizationDetail;
          setSharedWith(detail.shared_with.map((s) => ({ user_id: s.user_id, user_name: s.user_name, user_email: s.user_email })));
        }
        setSelectedUsers([]);
      } else {
        message.error(result.error || "Failed to share");
      }
    } finally {
      setShareLoading(false);
    }
  };

  const handleRemoveAccess = async (userId: string) => {
    if (!sharingResourceId) return;
    setShareLoading(true);
    try {
      const result = sharingResourceType === "dashboards"
        ? await removeDashboardShareAction(sharingResourceId, userId)
        : await removeShareAction(sharingResourceId, userId);
      if (result.ok) {
        message.success("Access removed");
        const detailResult = sharingResourceType === "dashboards"
          ? await getDashboardAction(sharingResourceId)
          : await getVisualizationAction(sharingResourceId);
        if (detailResult.ok && detailResult.data) {
          const detail = detailResult.data as DashboardDetail | VisualizationDetail;
          setSharedWith(detail.shared_with.map((s) => ({ user_id: s.user_id, user_name: s.user_name, user_email: s.user_email })));
        }
      } else {
        message.error(result.error || "Failed to remove access");
      }
    } finally {
      setShareLoading(false);
    }
  };

  // Filtered lists
  const filteredDashboards = useMemo(() => {
    if (!debouncedSearch.trim()) return dashList;
    const q = debouncedSearch.toLowerCase();
    return dashList.filter((d) => d.title.toLowerCase().includes(q) || d.creator_name.toLowerCase().includes(q));
  }, [dashList, debouncedSearch]);

  const filteredVisualizations = useMemo(() => {
    if (!debouncedSearch.trim()) return vizList;
    const q = debouncedSearch.toLowerCase();
    return vizList.filter((v) => v.title.toLowerCase().includes(q) || v.creator_name.toLowerCase().includes(q));
  }, [vizList, debouncedSearch]);

  // Dashboard columns
  const dashColumns = [
    {
      title: "Dashboard",
      key: "title",
      render: (_: unknown, r: DashboardListItem) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.title}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>by {r.creator_name}</Text>
        </div>
      ),
    },
    {
      title: "Visibility",
      key: "visibility",
      width: 100,
      render: (_: unknown, r: DashboardListItem) =>
        r.visibility === "public" ? (
          <Tag icon={<GlobalOutlined />} color="green">Public</Tag>
        ) : (
          <Tag icon={<LockOutlined />}> Private</Tag>
        ),
    },
    {
      title: "",
      key: "actions",
      width: 120,
      render: (_: unknown, r: DashboardListItem) =>
        r.created_by === currentUserId ? (
          <Button
            type="primary"
            ghost
            size="small"
            icon={<ShareAltOutlined />}
            onClick={() => handleOpenShare(r.id, r.title, "dashboards")}
          >
            Manage
          </Button>
        ) : (
          <Tag color="default" style={{ fontSize: 11 }}>Shared to you</Tag>
        ),
    },
  ];

  // Visualization columns
  const vizColumns = [
    {
      title: "Visualization",
      key: "title",
      render: (_: unknown, r: VisualizationListItem) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>{r.title}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {r.chart_type} &middot; by {r.creator_name}
          </Text>
        </div>
      ),
    },
    {
      title: "Visibility",
      key: "visibility",
      width: 100,
      render: (_: unknown, r: VisualizationListItem) =>
        r.visibility === "public" ? (
          <Tag icon={<GlobalOutlined />} color="green">Public</Tag>
        ) : (
          <Tag icon={<LockOutlined />}> Private</Tag>
        ),
    },
    {
      title: "",
      key: "actions",
      width: 120,
      render: (_: unknown, r: VisualizationListItem) =>
        r.created_by === currentUserId ? (
          <Button
            type="primary"
            ghost
            size="small"
            icon={<ShareAltOutlined />}
            onClick={() => handleOpenShare(r.id, r.title, "visualizations")}
          >
            Manage
          </Button>
        ) : (
          <Tag color="default" style={{ fontSize: 11 }}>Shared to you</Tag>
        ),
    },
  ];

  // Filtered members for select
  const availableMembers = orgMembers.filter((m) => {
    if (m.id === currentUserId) return false;
    if (m.id === createdBy) return false;
    if (sharedWith.some((s) => s.user_id === m.id)) return false;
    return true;
  });

  const filteredSharedWith = sharedWith.filter(
    (s) =>
      !shareSearch ||
      s.user_name.toLowerCase().includes(shareSearch.toLowerCase()) ||
      s.user_email.toLowerCase().includes(shareSearch.toLowerCase())
  );

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <TeamOutlined style={{ fontSize: 22, color: "#4F6CF7" }} />
        <Title level={4} style={{ margin: 0 }}>Access Management</Title>
      </div>

      <Card bordered style={{ borderColor: "#e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {isOwnerOrAdmin ? (
            <Segmented
              value={resourceType}
              onChange={(val) => { setResourceType(val as ResourceType); setSearch(""); }}
              options={[
                { label: <span><BarChartOutlined style={{ marginRight: 6 }} />Dashboards</span>, value: "dashboards" },
                { label: <span><PieChartOutlined style={{ marginRight: 6 }} />Visualizations</span>, value: "visualizations" },
              ]}
            />
          ) : (
            <Text strong style={{ fontSize: 15 }}><BarChartOutlined style={{ marginRight: 6 }} />Dashboards</Text>
          )}
          <Input
            placeholder={`Search ${resourceType}...`}
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 300 }}
          />
        </div>

        {resourceType === "dashboards" ? (
          <Table
            dataSource={filteredDashboards}
            columns={dashColumns}
            rowKey="id"
            loading={dashLoading}
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `${t} dashboards` }}
            locale={{ emptyText: <Empty description="No dashboards" /> }}
          />
        ) : (
          <Table
            dataSource={filteredVisualizations}
            columns={vizColumns}
            rowKey="id"
            loading={vizLoading}
            size="small"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `${t} visualizations` }}
            locale={{ emptyText: <Empty description="No visualizations" /> }}
          />
        )}
      </Card>

      {/* Share / Manage Access Modal */}
      <Modal
        title={`Manage Access â€” ${shareModalTitle}`}
        open={shareModalOpen}
        width={520}
        onCancel={() => { setShareModalOpen(false); setSelectedUsers([]); setShareSearch(""); }}
        footer={shareTab === "add" ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => { setShareModalOpen(false); setSelectedUsers([]); }}>Cancel</Button>
            <Button type="primary" loading={shareLoading} disabled={selectedUsers.length === 0} onClick={handleShare}>
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
            { label: `Manage Access (${sharedWith.length})`, value: "manage" },
          ]}
          block
          style={{ marginBottom: 16 }}
        />

        {shareTab === "add" ? (
          <Select
            mode="multiple"
            style={{ width: "100%" }}
            placeholder="Search and select users..."
            value={selectedUsers}
            onChange={setSelectedUsers}
            loading={shareLoading}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
            }
            options={availableMembers.map((m) => ({
              value: m.id,
              label: `${m.full_name} (${m.email})`,
            }))}
            showSearch
            notFoundContent="No users found"
          />
        ) : (
          <>
            {sharedWith.length > 5 && (
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
              {filteredSharedWith.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={shareSearch ? "No matching users" : "Not shared with anyone yet"}
                />
              ) : (
                filteredSharedWith.map((s) => (
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
                      onClick={() => handleRemoveAccess(s.user_id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
