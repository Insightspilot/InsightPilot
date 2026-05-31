"use client";

import { Button, Form, Input, Typography } from "antd";
import { SafetyOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface VerifyEmailFormProps {
  email: string;
  devOtp: string | null;
  loading: boolean;
  onVerify: (otp: string) => void;
}

export default function VerifyEmailForm({ email, devOtp, loading, onVerify }: VerifyEmailFormProps) {
  return (
    <Form layout="vertical" onFinish={(v) => onVerify(v.otp)} requiredMark={false}>
      <div className="text-center mb-6">
        <Text>
          We sent a verification code to <Text strong>{email}</Text>
        </Text>
        {devOtp && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <Text type="secondary" style={{ fontSize: 12 }}>Dev mode OTP:</Text>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 6, fontFamily: "monospace" }}>{devOtp}</div>
          </div>
        )}
      </div>
      <Form.Item name="otp" label="Verification Code" rules={[{ required: true, message: "Please enter the OTP" }, { len: 6, message: "OTP must be 6 digits" }]}>
        <Input prefix={<SafetyOutlined className="text-gray-400" />} placeholder="000000" maxLength={6} size="large" style={{ letterSpacing: 8, textAlign: "center", fontSize: 18 }} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>Verify &amp; Continue</Button>
      </Form.Item>
    </Form>
  );
}
