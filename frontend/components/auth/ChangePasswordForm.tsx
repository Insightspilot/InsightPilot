"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Form, Input, App } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { changePasswordAction } from "@/lib/actions";
import AuthLayout from "./AuthLayout";

export default function ChangePasswordForm() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { message } = App.useApp();

  const onSubmit = async (values: { current_password: string; new_password: string }) => {
    setLoading(true);
    try {
      const result = await changePasswordAction(values);
      if (!result.ok) {
        if (result.error === "Not authenticated") {
          router.push("/login");
          return;
        }
        message.error(result.error || "Failed to change password.");
        return;
      }
      message.success(result.data!.message);
      router.push("/login");
    } catch {
      message.error("Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Change Password" subtitle="You must change your temporary password before continuing">
      <Form layout="vertical" onFinish={onSubmit} requiredMark={false}>
        <Form.Item name="current_password" label="Current Password" rules={[{ required: true, message: "Please enter current password" }]}>
          <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="Your temporary password" size="large" />
        </Form.Item>
        <Form.Item name="new_password" label="New Password" rules={[{ required: true, message: "Please enter a new password" }, { min: 8, message: "Minimum 8 characters" }]}>
          <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="Minimum 8 characters" size="large" />
        </Form.Item>
        <Form.Item
          name="confirm_password"
          label="Confirm Password"
          dependencies={["new_password"]}
          rules={[
            { required: true, message: "Please confirm your password" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("new_password") === value) return Promise.resolve();
                return Promise.reject("Passwords do not match");
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="Re-enter new password" size="large" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>Update Password</Button>
        </Form.Item>
      </Form>
    </AuthLayout>
  );
}
