"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Form, Input, Divider, Typography, App, Space } from "antd";
import { MailOutlined, LockOutlined } from "@ant-design/icons";
import { loginAction, selectOrgAction } from "@/lib/actions";
import { LoginResponse } from "@/lib/auth";
import AuthLayout from "./AuthLayout";
import OrgSelector from "./OrgSelector";

const { Text, Link } = Typography;

export default function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [orgs, setOrgs] = useState<LoginResponse["orgs"]>(null);
  const router = useRouter();
  const { message } = App.useApp();

  const onLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const result = await loginAction(values);
      if (!result.ok) {
        message.error(result.error || "Login failed. Please try again.");
        return;
      }
      const data = result.data!;
      if (data.orgs && data.orgs.length > 1) {
        setOrgs(data.orgs);
        return;
      }
      router.push(data.force_password_change ? "/change-password" : "/dashboard");
    } catch {
      message.error("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onSelectOrg = async (orgId: string) => {
    setLoading(true);
    try {
      const result = await selectOrgAction({ org_id: orgId });
      if (!result.ok) {
        message.error(result.error || "Failed to select organization.");
        return;
      }
      router.push(result.data!.force_password_change ? "/change-password" : "/dashboard");
    } catch {
      message.error("Failed to select organization.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="InsightPilot" subtitle="Sign in to your account">
      {!orgs ? (
        <Form layout="vertical" onFinish={onLogin} requiredMark={false}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Please enter your email" },
              { type: "email", message: "Invalid email" },
            ]}
          >
            <Input prefix={<MailOutlined className="text-gray-400" />} placeholder="you@company.com" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="Enter your password" size="large" />
          </Form.Item>

          <div className="flex justify-end mb-4">
            <Link href="/forgot-password" style={{ color: "#000" }}>Forgot password?</Link>
          </div>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>Sign In</Button>
          </Form.Item>
        </Form>
      ) : (
        <OrgSelector orgs={orgs} loading={loading} onSelect={onSelectOrg} />
      )}

      <Divider plain>
        <Text type="secondary" style={{ fontSize: 13 }}>Don&apos;t have an account?</Text>
      </Divider>
      <Button block size="large" href="/signup" style={{ borderColor: "#000", color: "#000" }}>
        Create Organization
      </Button>
    </AuthLayout>
  );
}
