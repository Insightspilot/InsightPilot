"use client";

import { useState } from "react";
import {
  Card,
  Typography,
  Input,
  Button,
  Form,
  Divider,
  Tag,
  App,
  Avatar,
  Row,
  Col,
} from "antd";
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CalendarOutlined,
  CrownOutlined,
} from "@ant-design/icons";
import { UserProfile } from "@/lib/auth";
import { updateProfileAction, changePasswordAction } from "@/lib/actions";

const { Title, Text } = Typography;

interface SettingsContentProps {
  user: UserProfile;
  onProfileUpdate: (updated: Partial<UserProfile>) => void;
}

const ROLE_COLORS: Record<string, string> = {
  owner: "#2563EB",
  admin: "#8b5cf6",
  member: "#64748b",
};

export default function SettingsContent({ user, onProfileUpdate }: SettingsContentProps) {
  const { message } = App.useApp();

  // Profile form
  const [fullName, setFullName] = useState(user.full_name);
  const [profileLoading, setProfileLoading] = useState(false);
  const profileDirty = fullName.trim() !== user.full_name;

  // Password form
  const [passwordForm] = Form.useForm();
  const [passwordLoading, setPasswordLoading] = useState(false);

  const initials = user.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  const handleSaveProfile = async () => {
    const trimmed = fullName.trim();
    if (!trimmed) {
      message.error("Name cannot be empty");
      return;
    }
    setProfileLoading(true);
    try {
      const result = await updateProfileAction({ full_name: trimmed });
      if (result.ok) {
        message.success("Profile updated");
        onProfileUpdate({ full_name: trimmed });
      } else {
        message.error(result.error || "Failed to update profile");
      }
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (values: { current_password: string; new_password: string; confirm_password: string }) => {
    if (values.new_password !== values.confirm_password) {
      message.error("Passwords do not match");
      return;
    }
    setPasswordLoading(true);
    try {
      const result = await changePasswordAction({
        current_password: values.current_password,
        new_password: values.new_password,
      });
      if (result.ok) {
        message.success("Password changed successfully");
        passwordForm.resetFields();
      } else {
        message.error(result.error || "Failed to change password");
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Title level={4} style={{ marginBottom: 24, color: "#0f172a" }}>
        Settings
      </Title>

      {/* ── Profile Card ── */}
      <Card
        bordered
        style={{ borderColor: "#e2e8f0", marginBottom: 20, borderRadius: 12 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <Avatar
            size={64}
            style={{
              background: "linear-gradient(135deg, #2563EB 0%, #60a5fa 100%)",
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            {initials}
          </Avatar>
          <div>
            <Title level={5} style={{ margin: 0, color: "#0f172a" }}>{user.full_name}</Title>
            <Text style={{ color: "#64748b", fontSize: 13 }}>{user.email}</Text>
            <div style={{ marginTop: 4 }}>
              <Tag
                color={ROLE_COLORS[user.role || "member"]}
                style={{ borderRadius: 6, fontSize: 11, textTransform: "capitalize" }}
              >
                <CrownOutlined style={{ marginRight: 4 }} />
                {user.role || "Member"}
              </Tag>
              {user.is_email_verified ? (
                <Tag color="#10b981" style={{ borderRadius: 6, fontSize: 11 }}>
                  <CheckCircleOutlined style={{ marginRight: 4 }} />
                  Verified
                </Tag>
              ) : (
                <Tag color="#ef4444" style={{ borderRadius: 6, fontSize: 11 }}>
                  <CloseCircleOutlined style={{ marginRight: 4 }} />
                  Unverified
                </Tag>
              )}
            </div>
          </div>
        </div>

        <Divider style={{ margin: "0 0 20px" }} />

        <Row gutter={[20, 16]}>
          <Col xs={24} sm={12}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
              <UserOutlined style={{ marginRight: 6 }} />
              Full Name
            </label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              maxLength={255}
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
              <MailOutlined style={{ marginRight: 6 }} />
              Email Address
            </label>
            <Input
              value={user.email}
              disabled
              style={{ borderRadius: 8, background: "#f8fafc", color: "#64748b" }}
              suffix={<LockOutlined style={{ color: "#94a3b8", fontSize: 12 }} />}
            />
            <Text style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, display: "block" }}>
              Email cannot be changed
            </Text>
          </Col>
          <Col xs={24} sm={12}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
              <CalendarOutlined style={{ marginRight: 6 }} />
              Member Since
            </label>
            <Input
              value={memberSince}
              disabled
              style={{ borderRadius: 8, background: "#f8fafc", color: "#64748b" }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "#334155", display: "block", marginBottom: 6 }}>
              <SafetyOutlined style={{ marginRight: 6 }} />
              Role
            </label>
            <Input
              value={(user.role || "member").charAt(0).toUpperCase() + (user.role || "member").slice(1)}
              disabled
              style={{ borderRadius: 8, background: "#f8fafc", color: "#64748b" }}
            />
          </Col>
        </Row>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <Button
            type="primary"
            onClick={handleSaveProfile}
            loading={profileLoading}
            disabled={!profileDirty}
            style={{ borderRadius: 8 }}
          >
            Save Changes
          </Button>
        </div>
      </Card>

      {/* ── Change Password Card ── */}
      <Card
        bordered
        style={{ borderColor: "#e2e8f0", marginBottom: 20, borderRadius: 12 }}
      >
        <Title level={5} style={{ margin: "0 0 4px", color: "#0f172a" }}>
          <LockOutlined style={{ marginRight: 8, color: "#2563EB" }} />
          Change Password
        </Title>
        <Text style={{ color: "#64748b", fontSize: 13, display: "block", marginBottom: 20 }}>
          Update your password to keep your account secure.
        </Text>

        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
          requiredMark={false}
          style={{ maxWidth: 400 }}
        >
          <Form.Item
            name="current_password"
            label={<span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>Current Password</span>}
            rules={[{ required: true, message: "Enter your current password" }]}
          >
            <Input.Password placeholder="Enter current password" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item
            name="new_password"
            label={<span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>New Password</span>}
            rules={[
              { required: true, message: "Enter a new password" },
              { min: 8, message: "Password must be at least 8 characters" },
            ]}
          >
            <Input.Password placeholder="Enter new password" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label={<span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>Confirm New Password</span>}
            dependencies={["new_password"]}
            rules={[
              { required: true, message: "Confirm your new password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("new_password") === value) return Promise.resolve();
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm new password" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={passwordLoading}
              style={{ borderRadius: 8 }}
            >
              Update Password
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* ── Danger Zone ── */}
      <Card
        bordered
        style={{ borderColor: "#fecaca", marginBottom: 20, borderRadius: 12, background: "#fef2f2" }}
      >
        <Title level={5} style={{ margin: "0 0 4px", color: "#991b1b" }}>
          Danger Zone
        </Title>
        <Text style={{ color: "#b91c1c", fontSize: 13, display: "block", marginBottom: 16 }}>
          Irreversible actions. Please proceed with caution.
        </Text>
        <Button danger style={{ borderRadius: 8 }}>
          Delete Account
        </Button>
      </Card>
    </div>
  );
}
