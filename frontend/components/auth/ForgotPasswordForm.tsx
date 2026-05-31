"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Form, Input, Typography, App } from "antd";
import { MailOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons";
import { forgotPasswordAction, resetPasswordAction } from "@/lib/actions";
import AuthLayout from "./AuthLayout";

const { Text } = Typography;

export default function ForgotPasswordForm() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const router = useRouter();
  const { message } = App.useApp();

  const onRequestOtp = async (values: { email: string }) => {
    setLoading(true);
    try {
      const result = await forgotPasswordAction({ email: values.email });
      if (!result.ok) {
        message.error(result.error || "Request failed.");
        return;
      }
      setEmail(values.email);
      setDevOtp(result.data!.otp);
      message.success(result.data!.message);
      setStep(1);
    } catch {
      message.error("Request failed.");
    } finally {
      setLoading(false);
    }
  };

  const onReset = async (values: { otp: string; new_password: string }) => {
    setLoading(true);
    try {
      const result = await resetPasswordAction({ email, otp: values.otp, new_password: values.new_password });
      if (!result.ok) {
        message.error(result.error || "Reset failed.");
        return;
      }
      message.success(result.data!.message);
      router.push("/login");
    } catch {
      message.error("Reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle={step === 0 ? "Enter your email to receive a reset code" : "Enter the code and your new password"}
    >
      {step === 0 ? (
        <Form layout="vertical" onFinish={onRequestOtp} requiredMark={false}>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: "Please enter your email" }, { type: "email", message: "Invalid email" }]}>
            <Input prefix={<MailOutlined className="text-gray-400" />} placeholder="you@company.com" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>Send Reset Code</Button>
          </Form.Item>
        </Form>
      ) : (
        <Form layout="vertical" onFinish={onReset} requiredMark={false}>
          {devOtp && (
            <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
              <Text type="secondary" style={{ fontSize: 12 }}>Dev mode OTP:</Text>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 6, fontFamily: "monospace" }}>{devOtp}</div>
            </div>
          )}
          <Form.Item name="otp" label="Reset Code" rules={[{ required: true, message: "Please enter the code" }, { len: 6, message: "Code must be 6 digits" }]}>
            <Input prefix={<SafetyOutlined className="text-gray-400" />} placeholder="000000" maxLength={6} size="large" />
          </Form.Item>
          <Form.Item name="new_password" label="New Password" rules={[{ required: true, message: "Please enter a new password" }, { min: 8, message: "Minimum 8 characters" }]}>
            <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="Minimum 8 characters" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>Reset Password</Button>
          </Form.Item>
        </Form>
      )}

      <div className="text-center mt-4">
        <Button type="link" href="/login" style={{ color: "#000" }}>Back to Sign In</Button>
      </div>
    </AuthLayout>
  );
}
