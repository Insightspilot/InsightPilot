"use client";

import { useState } from "react";
import {
  Card,
  Typography,
  Collapse,
  Input,
  Button,
  Form,
  Tag,
  Row,
  Col,
  App,
} from "antd";
import {
  QuestionCircleOutlined,
  BookOutlined,
  RocketOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  PieChartOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  SendOutlined,
  MailOutlined,
  FileTextOutlined,
  SafetyOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useDebouncedValue } from "@/lib/hooks";

const { Title, Text, Paragraph } = Typography;

interface FAQItem {
  key: string;
  question: string;
  answer: string;
  tags: string[];
}

const faqItems: FAQItem[] = [
  {
    key: "1",
    question: "How do I connect a data source?",
    answer:
      "Navigate to Data Sources from the sidebar, click 'Connect Data Source', and fill in your database credentials. InsightPilot supports PostgreSQL, MySQL, Microsoft SQL Server, and MongoDB. You can test the connection before saving to ensure everything works correctly.",
    tags: ["data source", "connect", "database"],
  },
  {
    key: "2",
    question: "What database types are supported?",
    answer:
      "InsightPilot currently supports PostgreSQL, MySQL, Microsoft SQL Server, and MongoDB. Each data source can be configured with SSL for secure connections.",
    tags: ["database", "postgresql", "mysql", "mongodb", "sql server"],
  },
  {
    key: "3",
    question: "How do I create a visualization?",
    answer:
      "Go to the Visualizations page, click 'New Visualization', select a data source and run a query, then choose a chart type (bar, line, pie, area, scatter, or table). You can customize the chart configuration before saving.",
    tags: ["visualization", "chart", "create"],
  },
  {
    key: "4",
    question: "How do I build a dashboard?",
    answer:
      "Navigate to Dashboards, click 'New Dashboard', give it a title, then use the dashboard builder to add visualizations and text widgets. You can drag and resize widgets, organize them into tabs, and share the dashboard with your team.",
    tags: ["dashboard", "create", "builder"],
  },
  {
    key: "5",
    question: "How do I share dashboards or visualizations?",
    answer:
      "Open any dashboard or visualization you own, click the share button, and select team members to grant access. You can also manage shared access from the Access Management page. Shared users can view but not edit your content.",
    tags: ["share", "access", "permissions"],
  },
  {
    key: "6",
    question: "What user roles are available?",
    answer:
      "There are three roles: Owner (full control including billing and member management), Admin (can manage data sources, queries, and team members), and Member (can view dashboards and visualizations shared with them).",
    tags: ["roles", "permissions", "owner", "admin", "member"],
  },
  {
    key: "7",
    question: "How do I write SQL queries?",
    answer:
      "Go to the Queries page, select a data source and schema, then use the SQL editor to write and execute queries. You can browse tables and columns in the sidebar to help construct your queries. Use the Query Builder for a visual, no-code approach.",
    tags: ["query", "sql", "editor"],
  },
  {
    key: "8",
    question: "Can I use the Query Builder without writing SQL?",
    answer:
      "Yes! The Query Builder provides a visual interface where you can select tables, pick columns, add filters, sorting, and limits — all without writing any SQL. It generates the query for you automatically.",
    tags: ["query builder", "no-code", "visual"],
  },
  {
    key: "9",
    question: "How do I invite team members?",
    answer:
      "As an Owner, go to Team Members from the sidebar and click 'Invite Member'. Enter their email address and assign a role. They will receive an invitation to join your organization.",
    tags: ["team", "invite", "members"],
  },
  {
    key: "10",
    question: "How do I change my password?",
    answer:
      "Go to Settings from the sidebar or profile dropdown. In the Change Password section, enter your current password and your new password. The new password must be at least 8 characters long.",
    tags: ["password", "security", "settings"],
  },
];

const quickLinks = [
  {
    icon: <RocketOutlined style={{ fontSize: 24, color: "#2563EB" }} />,
    title: "Getting Started",
    description: "Connect your first data source and create a visualization",
    steps: [
      "Connect a data source (PostgreSQL, MySQL, etc.)",
      "Browse your tables and schemas",
      "Write or build a query",
      "Create a visualization from query results",
      "Add visualizations to a dashboard",
    ],
  },
  {
    icon: <DatabaseOutlined style={{ fontSize: 24, color: "#2563EB" }} />,
    title: "Data Sources",
    description: "Supported databases and connection setup",
    steps: [
      "PostgreSQL, MySQL, SQL Server, MongoDB",
      "SSL connections supported",
      "Test connection before saving",
      "Multiple data sources per organization",
    ],
  },
  {
    icon: <PieChartOutlined style={{ fontSize: 24, color: "#2563EB" }} />,
    title: "Visualizations",
    description: "Chart types and customization options",
    steps: [
      "Bar, Line, Pie, Area, Scatter charts",
      "Table view with search and column controls",
      "Configure axes, colors, and labels",
      "Share with team members",
    ],
  },
  {
    icon: <BarChartOutlined style={{ fontSize: 24, color: "#2563EB" }} />,
    title: "Dashboards",
    description: "Build and organize interactive dashboards",
    steps: [
      "Drag-and-drop layout builder",
      "Multiple tabs for organization",
      "Add text widgets for context",
      "Resize and reposition widgets",
      "Share with your team",
    ],
  },
  {
    icon: <TeamOutlined style={{ fontSize: 24, color: "#2563EB" }} />,
    title: "Team Management",
    description: "Roles, invitations, and access control",
    steps: [
      "Owner, Admin, and Member roles",
      "Invite members by email",
      "Manage per-resource sharing",
      "Access Management dashboard",
    ],
  },
  {
    icon: <SafetyOutlined style={{ fontSize: 24, color: "#2563EB" }} />,
    title: "Security",
    description: "Account security and best practices",
    steps: [
      "Change password regularly",
      "Email verification for new accounts",
      "SSL database connections",
      "Role-based access control",
    ],
  },
];

const keyboardShortcuts = [
  { keys: ["Ctrl", "Enter"], description: "Run query in SQL editor" },
  { keys: ["Ctrl", "S"], description: "Save current work" },
  { keys: ["Esc"], description: "Close modal or dialog" },
];

export default function HelpSupportContent() {
  const { message } = App.useApp();
  const [faqSearch, setFaqSearch] = useState("");
  const debouncedFaqSearch = useDebouncedValue(faqSearch, 300);
  const [contactForm] = Form.useForm();
  const [sending, setSending] = useState(false);

  const filteredFAQ = faqItems.filter((item) => {
    if (!debouncedFaqSearch.trim()) return true;
    const q = debouncedFaqSearch.toLowerCase();
    return (
      item.question.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q) ||
      item.tags.some((t) => t.includes(q))
    );
  });

  const handleContactSubmit = async () => {
    try {
      await contactForm.validateFields();
      setSending(true);
      // Simulate sending — replace with real API when available
      await new Promise((r) => setTimeout(r, 1000));
      message.success("Message sent! We'll get back to you soon.");
      contactForm.resetFields();
    } catch {
      // validation error
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 32,
          padding: "40px 24px 32px",
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563EB 50%, #3b82f6 100%)",
          borderRadius: 16,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            top: -60,
            right: -40,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.04)",
            bottom: -30,
            left: 40,
          }}
        />
        <QuestionCircleOutlined
          style={{ fontSize: 40, color: "rgba(255,255,255,0.9)", marginBottom: 12 }}
        />
        <Title level={3} style={{ color: "#fff", marginBottom: 4 }}>
          Help & Support
        </Title>
        <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 15 }}>
          Everything you need to get the most out of InsightPilot
        </Text>
      </div>

      {/* Quick Start Guides */}
      <Title level={5} style={{ marginBottom: 16, color: "#1e293b" }}>
        <BookOutlined style={{ marginRight: 8, color: "#2563EB" }} />
        Quick Start Guides
      </Title>
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        {quickLinks.map((link, i) => (
          <Col xs={24} sm={12} md={8} key={i}>
            <Card
              hoverable
              style={{
                height: "100%",
                borderColor: "#e2e8f0",
                borderRadius: 12,
              }}
              styles={{ body: { padding: "20px 18px" } }}
            >
              <div style={{ marginBottom: 12 }}>{link.icon}</div>
              <Text strong style={{ fontSize: 14, color: "#1e293b" }}>
                {link.title}
              </Text>
              <Paragraph
                style={{ color: "#64748b", fontSize: 12, marginTop: 4, marginBottom: 12 }}
              >
                {link.description}
              </Paragraph>
              <ul
                style={{
                  paddingLeft: 18,
                  margin: 0,
                  color: "#475569",
                  fontSize: 12,
                  lineHeight: "22px",
                }}
              >
                {link.steps.map((step, j) => (
                  <li key={j}>{step}</li>
                ))}
              </ul>
            </Card>
          </Col>
        ))}
      </Row>

      {/* FAQ */}
      <Title level={5} style={{ marginBottom: 16, color: "#1e293b" }}>
        <BulbOutlined style={{ marginRight: 8, color: "#2563EB" }} />
        Frequently Asked Questions
      </Title>
      <Input
        placeholder="Search FAQs..."
        prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
        value={faqSearch}
        onChange={(e) => setFaqSearch(e.target.value)}
        allowClear
        style={{ marginBottom: 16, borderColor: "#e2e8f0" }}
      />
      {filteredFAQ.length > 0 ? (
        <Collapse
          accordion
          style={{ marginBottom: 32, borderColor: "#e2e8f0", background: "#fff" }}
          items={filteredFAQ.map((item) => ({
            key: item.key,
            label: (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <QuestionCircleOutlined style={{ color: "#2563EB", flexShrink: 0 }} />
                <Text strong style={{ color: "#1e293b" }}>
                  {item.question}
                </Text>
              </div>
            ),
            children: (
              <div>
                <Paragraph style={{ color: "#475569", marginBottom: 8 }}>
                  {item.answer}
                </Paragraph>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {item.tags.map((tag) => (
                    <Tag
                      key={tag}
                      style={{
                        background: "#eff6ff",
                        borderColor: "#bfdbfe",
                        color: "#2563EB",
                        fontSize: 11,
                      }}
                    >
                      {tag}
                    </Tag>
                  ))}
                </div>
              </div>
            ),
          }))}
        />
      ) : (
        <Card
          style={{
            marginBottom: 32,
            borderColor: "#e2e8f0",
            textAlign: "center",
            padding: "32px 0",
          }}
        >
          <SearchOutlined style={{ fontSize: 32, color: "#cbd5e1", marginBottom: 8 }} />
          <br />
          <Text style={{ color: "#94a3b8" }}>No FAQs matching &quot;{faqSearch}&quot;</Text>
        </Card>
      )}

      {/* Keyboard Shortcuts */}
      <Title level={5} style={{ marginBottom: 16, color: "#1e293b" }}>
        <ThunderboltOutlined style={{ marginRight: 8, color: "#2563EB" }} />
        Keyboard Shortcuts
      </Title>
      <Card
        style={{ marginBottom: 32, borderColor: "#e2e8f0", borderRadius: 12 }}
        styles={{ body: { padding: 0 } }}
      >
        {keyboardShortcuts.map((shortcut, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 20px",
              borderBottom:
                i < keyboardShortcuts.length - 1 ? "1px solid #f1f5f9" : "none",
            }}
          >
            <Text style={{ color: "#475569", fontSize: 13 }}>
              {shortcut.description}
            </Text>
            <div style={{ display: "flex", gap: 4 }}>
              {shortcut.keys.map((key) => (
                <Tag
                  key={key}
                  style={{
                    background: "#f8fafc",
                    borderColor: "#e2e8f0",
                    color: "#334155",
                    fontFamily: "monospace",
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    padding: "1px 8px",
                  }}
                >
                  {key}
                </Tag>
              ))}
            </div>
          </div>
        ))}
      </Card>

      {/* Contact Support */}
      <Title level={5} style={{ marginBottom: 16, color: "#1e293b" }}>
        <MailOutlined style={{ marginRight: 8, color: "#2563EB" }} />
        Contact Support
      </Title>
      <Card style={{ borderColor: "#e2e8f0", borderRadius: 12, marginBottom: 32 }}>
        <Paragraph style={{ color: "#64748b", marginBottom: 20 }}>
          Can&apos;t find what you&apos;re looking for? Send us a message and
          we&apos;ll get back to you as soon as possible.
        </Paragraph>
        <Form form={contactForm} layout="vertical">
          <Form.Item
            name="subject"
            label={<Text style={{ color: "#334155", fontWeight: 500 }}>Subject</Text>}
            rules={[{ required: true, message: "Please enter a subject" }]}
          >
            <Input
              prefix={<FileTextOutlined style={{ color: "#94a3b8" }} />}
              placeholder="Brief description of your issue"
              style={{ borderColor: "#e2e8f0" }}
            />
          </Form.Item>
          <Form.Item
            name="message"
            label={<Text style={{ color: "#334155", fontWeight: 500 }}>Message</Text>}
            rules={[{ required: true, message: "Please enter your message" }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Describe your issue or question in detail..."
              style={{ borderColor: "#e2e8f0" }}
            />
          </Form.Item>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={sending}
            onClick={handleContactSubmit}
            style={{
              background: "linear-gradient(135deg, #2563EB, #3b82f6)",
              border: "none",
              borderRadius: 8,
              fontWeight: 500,
            }}
          >
            Send Message
          </Button>
        </Form>
      </Card>

      {/* App Info */}
      <div style={{ textAlign: "center", padding: "16px 0 8px", color: "#94a3b8", fontSize: 12 }}>
        InsightPilot Analytics Platform &middot; Version 1.0.0
      </div>
    </div>
  );
}
