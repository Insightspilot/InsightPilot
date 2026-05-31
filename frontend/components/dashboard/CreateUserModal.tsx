"use client";

import { useState } from "react";
import { Modal, Form, Input, Select, Button, Alert, Typography, App } from "antd";
import { UserAddOutlined } from "@ant-design/icons";
import { createUserAction } from "@/lib/actions";

const { Text } = Typography;

interface CreatedUser {
  email: string;
  full_name: string;
  temp_password: string;
  role: string;
}

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateUserModal({ open, onClose, onCreated }: CreateUserModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<CreatedUser | null>(null);

  const handleCreate = async (values: { email: string; role: "admin" | "member" }) => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (createdUser) onCreated();
    setCreatedUser(null);
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={createdUser ? "User Created" : "Create User"}
      open={open}
      onCancel={handleClose}
      footer={createdUser ? [<Button key="close" type="primary" onClick={handleClose}>Done</Button>] : null}
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
                <Text code style={{ fontSize: 16, letterSpacing: 1 }} copyable={{ text: createdUser.temp_password }}>
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
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false} initialValues={{ role: "member" }}>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: "Please enter the user's email" }, { type: "email", message: "Invalid email" }]}>
            <Input prefix={<UserAddOutlined className="text-gray-400" />} placeholder="user@company.com" size="large" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true, message: "Please select a role" }]}>
            <Select size="large">
              <Select.Option value="member">Member</Select.Option>
              <Select.Option value="admin">Admin</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>Create User</Button>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
