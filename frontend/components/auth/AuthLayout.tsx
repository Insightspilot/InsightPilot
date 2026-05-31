import { Typography } from "antd";

const { Title, Text } = Typography;

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  maxWidth?: number;
}

export default function AuthLayout({ title, subtitle, children, maxWidth = 400 }: AuthLayoutProps) {
  return (
    <div className="flex flex-1 items-center justify-center bg-gray-50">
      <div className="w-full mx-4" style={{ maxWidth }}>
        <div className="text-center mb-8">
          <Title level={2} style={{ marginBottom: 4, fontWeight: 700 }}>
            {title}
          </Title>
          <Text type="secondary">{subtitle}</Text>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
