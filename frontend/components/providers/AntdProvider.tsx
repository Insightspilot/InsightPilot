"use client";

import { ConfigProvider, theme, App as AntApp } from "antd";
import { AntdRegistry } from "@ant-design/nextjs-registry";

export default function AntdProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AntdRegistry>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#2563EB",
            colorBgContainer: "#ffffff",
            colorText: "#1e293b",
            colorTextSecondary: "#64748b",
            borderRadius: 10,
            fontFamily:
              "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif",
            colorLink: "#2563EB",
            colorSuccess: "#10b981",
            colorWarning: "#f59e0b",
            colorError: "#ef4444",
          },
          components: {
            Button: {
              primaryColor: "#ffffff",
              colorPrimary: "#2563EB",
              algorithm: true,
            },
            Input: {
              activeBorderColor: "#2563EB",
              hoverBorderColor: "#60a5fa",
            },
            Menu: {
              itemSelectedBg: "transparent",
              itemSelectedColor: "#ffffff",
            },
            Card: {
              borderRadiusLG: 12,
            },
          },
          algorithm: theme.defaultAlgorithm,
        }}
      >
        <AntApp style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          {children}
        </AntApp>
      </ConfigProvider>
    </AntdRegistry>
  );
}
