"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Form, Input, Divider, Typography, App, Steps } from "antd";
import { MailOutlined, LockOutlined, UserOutlined, BankOutlined, SafetyOutlined } from "@ant-design/icons";
import { signupAction, verifyEmailAction } from "@/lib/actions";
import AuthLayout from "./AuthLayout";
import VerifyEmailForm from "./VerifyEmailForm";

const { Text } = Typography;

export default function SignupForm() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const router = useRouter();
  const { message } = App.useApp();

  const onSignup = async (values: { email: string; password: string; full_name: string; org_name: string }) => {
    setLoading(true);
    try {
      const result = await signupAction(values);
      if (!result.ok) {
        message.error(result.error || "Signup failed. Please try again.");
        return;
      }
      setEmail(values.email);
      setDevOtp(result.data!.otp);
      message.success(result.data!.message);
      setStep(1);
    } catch {
      message.error("Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (otp: string) => {
    setLoading(true);
    try {
      const result = await verifyEmailAction({ email, otp });
      if (!result.ok) {
        message.error(result.error || "Verification failed. Please try again.");
        return;
      }
      message.success(result.data!.message);
      router.push("/login");
    } catch {
      message.error("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="InsightPilot" subtitle="Create your organization" maxWidth={440}>
      <Steps current={step} size="small" style={{ marginBottom: 40 }} items={[{ title: "Details" }, { title: "Verify Email" }]} />

      {step === 0 ? (
        <Form layout="vertical" onFinish={onSignup} requiredMark={false}>
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true, message: "Please enter your name" }]}>
            <Input prefix={<UserOutlined className="text-gray-400" />} placeholder="John Doe" size="large" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, message: "Please enter your email" }, { type: "email", message: "Invalid email" }]}>
            <Input prefix={<MailOutlined className="text-gray-400" />} placeholder="you@company.com" size="large" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: "Please enter a password" }, { min: 8, message: "Minimum 8 characters" }]}>
            <Input.Password prefix={<LockOutlined className="text-gray-400" />} placeholder="Minimum 8 characters" size="large" />
          </Form.Item>
          <Form.Item name="org_name" label="Organization Name" rules={[{ required: true, message: "Please enter organization name" }]}>
            <Input prefix={<BankOutlined className="text-gray-400" />} placeholder="Acme Corp" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>Create Account</Button>
          </Form.Item>
        </Form>
      ) : (
        <VerifyEmailForm email={email} devOtp={devOtp} loading={loading} onVerify={onVerify} />
      )}

      <Divider plain>
        <Text type="secondary" style={{ fontSize: 13 }}>Already have an account?</Text>
      </Divider>
      <Button block size="large" href="/login" style={{ borderColor: "#000", color: "#000" }}>Sign In</Button>
    </AuthLayout>
  );
}
