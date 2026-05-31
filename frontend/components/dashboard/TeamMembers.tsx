"use client";

import { useState, useEffect, useCallback } from "react";
import { useDebouncedValue } from "@/lib/hooks";
import { Card, Table, Input, Button, Space, Select, Tag, Popconfirm, App } from "antd";
import { SearchOutlined, UserAddOutlined, DeleteOutlined } from "@ant-design/icons";
import { listMembersAction, updateMemberRoleAction, removeMemberAction } from "@/lib/actions";
import CreateUserModal from "./CreateUserModal";

export interface OrgMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  joined_at: string;
}

interface TeamMembersProps {
  onMemberCountChange?: (count: number) => void;
}

export default function TeamMembers({ onMemberCountChange }: TeamMembersProps) {
  const { message } = App.useApp();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listMembersAction();
      if (result.ok && result.data) {
        setMembers(result.data);
        onMemberCountChange?.(result.data.length);
      }
    } finally {
      setLoading(false);
    }
  }, [onMemberCountChange]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

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

  const filteredMembers = members.filter((m) => {
    if (!debouncedSearch.trim()) return true;
    const q = debouncedSearch.toLowerCase();
    return m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.role.toLowerCase().includes(q);
  });

  return (
    <>
      <Card
        title="Team Members"
        bordered
        style={{ borderColor: "#e2e8f0" }}
        extra={
          <Space>
            <Input
              placeholder="Search members..."
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 220 }}
            />
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => setModalOpen(true)}>
              Invite Member
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={filteredMembers}
          rowKey="user_id"
          loading={loading}
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

      <CreateUserModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={fetchMembers} />
    </>
  );
}
