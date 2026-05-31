"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Layout,
  Typography,
  Button,
  Dropdown,
  Avatar,
  Space,
  Card,
  Row,
  Col,
  Statistic,
  Modal,
  Form,
  Input,
  Select,
  App,
  Alert,
  Table,
  Tag,
  Popconfirm,
  Menu,
} from "antd";
import type { MenuProps } from "antd";
import {
  UserOutlined,
  LogoutOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  TeamOutlined,
  SettingOutlined,
  UserAddOutlined,
  DeleteOutlined,
  DashboardOutlined,
  SearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { logoutAction, createUserAction, listMembersAction, updateMemberRoleAction, removeMemberAction } from "@/lib/actions";
import { UserProfile } from "@/lib/auth";
import { useActivityTracker } from "@/components/providers/useActivityTracker";
import DataSourcesContent from "@/components/dashboard/DataSourcesContent";
import QueriesContent from "@/components/dashboard/QueriesContent";

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

interface CreatedUser {
  email: string;
  full_name: string;
  temp_password: string;
  role: string;
}

interface OrgMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  joined_at: string;
}

export default function DashboardClient({ user }: { user: UserProfile }) {
  const router = useRouter();
  const { message } = App.useApp();
  const { track } = useActivityTracker();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);
  const [form] = Form.useForm();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [activeKey, setActiveKey] = useState("overview");
  const [sidebarSearch, setSidebarSearch] = useState("");

  const isOwner = user.role === "owner";
  const isOwnerOrAdmin = user.role === "owner" || user.role === "admin";

  type MenuItem = Required<MenuProps>["items"][number] & {
    label?: string | React.ReactNode;
    children?: MenuItem[];
    searchText?: string;
  };

  const allMenuItems: MenuItem[] = useMemo(() => [
    {
      key: "grp-analytics",
      label: "Analytics",
      type: "group" as const,
      children: [
        { key: "overview", icon: <DashboardOutlined />, label: "Overview", searchText: "overview dashboard home" },
        ...(isOwnerOrAdmin
          ? [{ key: "data-sources", icon: <DatabaseOutlined />, label: "Data Sources", searchText: "data sources connect database" }]
          : []),
        { key: "dashboards", icon: <BarChartOutlined />, label: "Dashboards", searchText: "dashboards charts reports" },
        ...(isOwnerOrAdmin
          ? [{ key: "queries", icon: <FileTextOutlined />, label: "Queries", searchText: "queries sql run" }]
          : []),
      ],
    },
    ...(isOwner
      ? [
          {
            key: "grp-management",
            label: "Management",
            type: "group" as const,
            children: [
              { key: "team", icon: <TeamOutlined />, label: "Team Members", searchText: "team members users invite" },
              { key: "access", icon: <SafetyOutlined />, label: "Access Management", searchText: "access management sharing permissions" },
            ],
          },
        ]
      : []),
    {
      key: "grp-settings",
      label: "Settings",
      type: "group" as const,
      children: [
        { key: "settings", icon: <SettingOutlined />, label: "Settings", searchText: "settings preferences configuration" },
        { key: "help", icon: <QuestionCircleOutlined />, label: "Help & Support", searchText: "help support documentation" },
      ],
    },
  ], [isOwner, isOwnerOrAdmin]);

  const filteredMenuItems = useMemo(() => {
    if (!sidebarSearch.trim()) return allMenuItems;
    const q = sidebarSearch.toLowerCase();
    return allMenuItems
      .map((group) => {
        if (!group || !("children" in group) || !group.children) return null;
        const filtered = group.children.filter((item) => {
          const text = (item as MenuItem)?.searchText || "";
          const label = typeof (item as MenuItem)?.label === "string" ? (item as MenuItem).label as string : "";
          return text.toLowerCase().includes(q) || label.toLowerCase().includes(q);
        });
        if (filtered.length === 0) return null;
        return { ...group, children: filtered };
      })
      .filter(Boolean) as MenuItem[];
  }, [sidebarSearch, allMenuItems]);

  const fetchMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const result = await listMembersAction();
      if (result.ok && result.data) {
        setMembers(result.data);
      }
    } finally {
      setMembersLoading(false);
    }
  }, []);

  // Track page/section navigation
  useEffect(() => {
    track("page.viewed", { metadata: { section: activeKey } });
  }, [activeKey, track]);

  useEffect(() => {
    if (isOwner) {
      fetchMembers();
    }
  }, [isOwner, fetchMembers]);

  const handleRoleChange = async (userId: string, newRole: "admin" | "member") => {
    setEditingRole(userId);
    try {
      const result = await updateMemberRoleAction(userId, newRole);
      if (result.ok) {
        message.success(result.data?.message || "Role updated");
        fetchMembers();
      } else {
        message.error(result.error || "Failed to update role");
      }
    } catch {
      message.error("Failed to update role");
    } finally {
      setEditingRole(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const result = await removeMemberAction(userId);
      if (result.ok) {
        message.success(result.data?.message || "Member removed");
        fetchMembers();
      } else {
        message.error(result.error || "Failed to remove member");
      }
    } catch {
      message.error("Failed to remove member");
    }
  };

  const handleLogout = async () => {
    await logoutAction();
    router.replace("/login");
  };

  const handleCreateUser = async (values: {
    email: string;
    role: "admin" | "member";
  }) => {
    setCreateLoading(true);
    try {
      const full_name = values.email.split("@")[0];
      const result = await createUserAction({ ...values, full_name });
      if (!result.ok) {
        message.error(result.error || "Failed to create user.");
        return;
      }
      setCreatedUser(result.data!);
      form.resetFields();
    } catch {
      message.error("Failed to create user.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCloseModal = () => {
    setCreateModalOpen(false);
    if (createdUser) {
      fetchMembers();
    }
    setCreatedUser(null);
    form.resetFields();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success("Copied to clipboard");
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          background: "#f7f9fc",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px 0 0",
          height: 56,
          position: "sticky",
          top: 0,
          zIndex: 10,
          borderBottom: "1px solid #e8e8e8",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ color: "#1a1a1a", fontSize: 16, width: 56, height: 56 }}
          />
          <Title
            level={5}
            style={{ color: "#1a1a1a", margin: "0 0 0 8px", fontWeight: 700 }}
          >
            InsightPilot
          </Title>
        </div>

        <Dropdown
          menu={{
            items: [
              {
                key: "profile",
                label: (
                  <div>
                    <div style={{ fontWeight: 600 }}>{user.full_name}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {user.email}
                    </div>
                  </div>
                ),
                disabled: true,
              },
              { type: "divider" },
              {
                key: "settings",
                icon: <SettingOutlined />,
                label: "Settings",
              },
              {
                key: "logout",
                icon: <LogoutOutlined />,
                label: "Sign Out",
                danger: true,
                onClick: handleLogout,
              },
            ],
          }}
          placement="bottomRight"
          trigger={["click"]}
        >
          <Button
            type="text"
            style={{ color: "#1a1a1a", height: 40 }}
          >
            <Space>
              <Avatar
                size={28}
                style={{ backgroundColor: "#e8e8e8" }}
                icon={<UserOutlined />}
              />
              <span style={{ color: "#1a1a1a" }}>{user.full_name}</span>
            </Space>
          </Button>
        </Dropdown>
      </Header>

      <Layout>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          width={240}
          collapsedWidth={0}
          style={{
            background: "#fff",
            borderRight: "1px solid #f0f0f0",
            position: "sticky",
            top: 56,
            height: "calc(100vh - 56px)",
            overflow: "auto",
          }}
          breakpoint="md"
          onBreakpoint={(broken) => setCollapsed(broken)}
        >
          {!collapsed && (
            <div style={{ padding: "12px 12px 4px" }}>
              <Input
                placeholder="Search..."
                prefix={<SearchOutlined style={{ color: "#bbb" }} />}
                allowClear
                size="small"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                style={{ borderRadius: 6 }}
              />
            </div>
          )}
          <Menu
            mode="inline"
            selectedKeys={[activeKey]}
            onClick={({ key }) => { setActiveKey(key); setSidebarSearch(""); }}
            style={{ border: "none", marginTop: 4 }}
            items={filteredMenuItems}
          />
        </Sider>

      <Content style={{ padding: "32px", background: "#fafafa", minHeight: "calc(100vh - 56px)" }}>
        {activeKey === "overview" && (
          <>
            <div style={{ marginBottom: 32 }}>
              <Title level={3} style={{ marginBottom: 4 }}>
                Welcome back, {user.full_name?.split(" ")[0]}
              </Title>
              <Text type="secondary">
                Here&apos;s an overview of your analytics workspace
              </Text>
            </div>

            <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
              <Col xs={24} sm={12} lg={6}>
                <Card bordered style={{ borderColor: "#eee" }}>
                  <Statistic title="Data Sources" value={0} prefix={<DatabaseOutlined />} />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card bordered style={{ borderColor: "#eee" }}>
                  <Statistic title="Dashboards" value={0} prefix={<BarChartOutlined />} />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card bordered style={{ borderColor: "#eee" }}>
                  <Statistic title="Team Members" value={members.length || 1} prefix={<TeamOutlined />} />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card bordered style={{ borderColor: "#eee" }}>
                  <Statistic title="Queries Run" value={0} prefix={<BarChartOutlined />} />
                </Card>
              </Col>
            </Row>

            <Row gutter={[24, 24]}>
              <Col xs={24} lg={16}>
                <Card title="Recent Activity" bordered style={{ borderColor: "#eee" }}>
                  <div style={{ padding: "40px 0", textAlign: "center", color: "#999" }}>
                    <BarChartOutlined style={{ fontSize: 48, color: "#ddd", marginBottom: 16 }} />
                    <div>No activity yet. Connect a data source to get started.</div>
                  </div>
                </Card>
              </Col>
              <Col xs={24} lg={8}>
                <Card title="Quick Actions" bordered style={{ borderColor: "#eee" }}>
                  <Space direction="vertical" style={{ width: "100%" }} size="middle">
                    {isOwnerOrAdmin && (
                      <Button block icon={<DatabaseOutlined />} onClick={() => setActiveKey("data-sources")}>
                        Connect Data Source
                      </Button>
                    )}
                    <Button block icon={<BarChartOutlined />}>
                      Create Dashboard
                    </Button>
                  </Space>
                </Card>
              </Col>
            </Row>
          </>
        )}

        {activeKey === "team" && isOwner && (
          <Card
            title="Team Members"
            bordered
            style={{ borderColor: "#eee" }}
            extra={
              <Space>
                <Input
                  placeholder="Search members..."
                  prefix={<SearchOutlined style={{ color: "#bbb" }} />}
                  allowClear
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  style={{ width: 220 }}
                />
                <Button type="primary" icon={<UserAddOutlined />} onClick={() => setCreateModalOpen(true)}>
                  Invite Member
                </Button>
              </Space>
            }
          >
            <Table
              dataSource={members.filter((m) => {
                if (!memberSearch.trim()) return true;
                const q = memberSearch.toLowerCase();
                return (
                  m.full_name.toLowerCase().includes(q) ||
                  m.email.toLowerCase().includes(q) ||
                  m.role.toLowerCase().includes(q)
                );
              })}
              rowKey="user_id"
              loading={membersLoading}
              pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `${total} members` }}
              columns={[
                { title: "Name", dataIndex: "full_name", key: "full_name", sorter: (a: OrgMember, b: OrgMember) => a.full_name.localeCompare(b.full_name) },
                { title: "Email", dataIndex: "email", key: "email", sorter: (a: OrgMember, b: OrgMember) => a.email.localeCompare(b.email) },
                {
                  title: "Role",
                  dataIndex: "role",
                  key: "role",
                  sorter: (a: OrgMember, b: OrgMember) => a.role.localeCompare(b.role),
                  render: (role: string, record: OrgMember) => {
                    if (role === "owner") return <Tag color="gold">Owner</Tag>;
                    return (
                      <Select
                        value={role}
                        size="small"
                        style={{ width: 110 }}
                        loading={editingRole === record.user_id}
                        onChange={(val) => handleRoleChange(record.user_id, val as "admin" | "member")}
                      >
                        <Select.Option value="admin">Admin</Select.Option>
                        <Select.Option value="member">Member</Select.Option>
                      </Select>
                    );
                  },
                },
                {
                  title: "Joined",
                  dataIndex: "joined_at",
                  key: "joined_at",
                  sorter: (a: OrgMember, b: OrgMember) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
                  defaultSortOrder: "descend" as const,
                  render: (date: string) => new Date(date).toLocaleDateString(),
                },
                {
                  title: "",
                  key: "actions",
                  width: 60,
                  render: (_: unknown, record: OrgMember) => {
                    if (record.role === "owner") return null;
                    return (
                      <Popconfirm
                        title="Remove member"
                        description={`Remove ${record.full_name} from the organization?`}
                        onConfirm={() => handleRemoveMember(record.user_id)}
                        okText="Remove"
                        okButtonProps={{ danger: true }}
                      >
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    );
                  },
                },
              ]}
            />
          </Card>
        )}

        {activeKey === "data-sources" && isOwnerOrAdmin && (
          <DataSourcesContent />
        )}

        {activeKey === "dashboards" && (
          <Card bordered style={{ borderColor: "#eee" }}>
            <div style={{ padding: "60px 0", textAlign: "center", color: "#999" }}>
              <BarChartOutlined style={{ fontSize: 48, color: "#ddd", marginBottom: 16 }} />
              <div>No dashboards created yet.</div>
            </div>
          </Card>
        )}

        {activeKey === "queries" && isOwnerOrAdmin && (
          <QueriesContent />
        )}

        {activeKey === "access" && isOwner && (
          <Card bordered style={{ borderColor: "#eee" }}>
            <div style={{ padding: "60px 0", textAlign: "center", color: "#999" }}>
              <SafetyOutlined style={{ fontSize: 48, color: "#ddd", marginBottom: 16 }} />
              <div>Access management is available in the new shell.</div>
            </div>
          </Card>
        )}

        {activeKey === "settings" && (
          <Card bordered style={{ borderColor: "#eee" }}>
            <div style={{ padding: "60px 0", textAlign: "center", color: "#999" }}>
              <SettingOutlined style={{ fontSize: 48, color: "#ddd", marginBottom: 16 }} />
              <div>Settings coming soon.</div>
            </div>
          </Card>
        )}

        {activeKey === "help" && (
          <Card bordered style={{ borderColor: "#eee" }}>
            <div style={{ padding: "60px 0", textAlign: "center", color: "#999" }}>
              <QuestionCircleOutlined style={{ fontSize: 48, color: "#ddd", marginBottom: 16 }} />
              <div>Help &amp; support coming soon.</div>
            </div>
          </Card>
        )}
      </Content>
      </Layout>

      <Modal
        title={createdUser ? "User Created" : "Create User"}
        open={createModalOpen}
        onCancel={handleCloseModal}
        footer={createdUser ? [
          <Button key="close" type="primary" onClick={handleCloseModal}>
            Done
          </Button>,
        ] : null}
        destroyOnClose
      >
        {createdUser ? (
          <div>
            <Alert
              message="User created successfully"
              description="Share the credentials below with the user. They will be required to change their password on first login."
              type="success"
              showIcon
              style={{ marginBottom: 20 }}
            />

            <div style={{ background: "#f5f5f5", borderRadius: 8, padding: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Email</Text>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Text copyable={{ text: createdUser.email }}>{createdUser.email}</Text>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Temporary Password</Text>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Text
                    code
                    style={{ fontSize: 16, letterSpacing: 1 }}
                    copyable={{ text: createdUser.temp_password }}
                  >
                    {createdUser.temp_password}
                  </Text>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Role</Text>
                <div style={{ fontWeight: 600, textTransform: "capitalize" }}>{createdUser.role}</div>
              </div>
            </div>
          </div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreateUser}
            requiredMark={false}
            initialValues={{ role: "member" }}
          >
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Please enter the user's email" },
                { type: "email", message: "Invalid email" },
              ]}
            >
              <Input
                prefix={<UserAddOutlined className="text-gray-400" />}
                placeholder="user@company.com"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="role"
              label="Role"
              rules={[{ required: true, message: "Please select a role" }]}
            >
              <Select size="large">
                <Select.Option value="member">Member</Select.Option>
                <Select.Option value="admin">Admin</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={createLoading}
              >
                Create User
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </Layout>
  );
}
