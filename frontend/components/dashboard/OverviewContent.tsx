"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Button,
  Space,
  Tag,
  List,
  Avatar,
  Skeleton,
  Empty,
  Tooltip,
  Badge,
  Progress,
} from "antd";
import {
  DatabaseOutlined,
  BarChartOutlined,
  TeamOutlined,
  DashboardOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  FireOutlined,
  TrophyOutlined,
  RiseOutlined,
  UserOutlined,
  ThunderboltOutlined,
  LineChartOutlined,
  PieChartOutlined,
  AreaChartOutlined,
  DotChartOutlined,
  TableOutlined,
  GlobalOutlined,
  LockOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { getOverviewAction } from "@/lib/actions";
import type { OverviewData, OverviewDashboardItem, OverviewVisualizationItem } from "@/lib/actions";

const { Title, Text } = Typography;

interface OverviewContentProps {
  userName: string;
  orgName: string;
  role: "owner" | "admin" | "member";
  onNavigate: (key: string) => void;
}

const CHART_ICONS: Record<string, React.ReactNode> = {
  bar: <BarChartOutlined />,
  line: <LineChartOutlined />,
  pie: <PieChartOutlined />,
  area: <AreaChartOutlined />,
  scatter: <DotChartOutlined />,
  table: <TableOutlined />,
};

const DS_TYPE_COLORS: Record<string, string> = {
  postgresql: "#336791",
  mysql: "#F29111",
  mssql: "#CC2927",
  mongodb: "#00684A",
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

export default function OverviewContent({ userName, orgName, role, onNavigate }: OverviewContentProps) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const isOwnerOrAdmin = isOwner || isAdmin;

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getOverviewAction();
      if (result.ok && result.data) {
        setData(result.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const firstName = userName?.split(" ")[0] || "there";
  const greeting = getGreeting();
  const displayOrgName = data?.org_name || orgName;

  if (loading) {
    return (
      <div>
        <Skeleton active paragraph={{ rows: 1 }} style={{ marginBottom: 32 }} />
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {[1, 2, 3, 4].map((i) => (
            <Col xs={24} sm={12} lg={6} key={i}>
              <Card bordered style={{ borderColor: "#e2e8f0" }}>
                <Skeleton active paragraph={{ rows: 1 }} />
              </Card>
            </Col>
          ))}
        </Row>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}><Card bordered style={{ borderColor: "#e2e8f0" }}><Skeleton active paragraph={{ rows: 5 }} /></Card></Col>
          <Col xs={24} lg={8}><Card bordered style={{ borderColor: "#e2e8f0" }}><Skeleton active paragraph={{ rows: 5 }} /></Card></Col>
        </Row>
      </div>
    );
  }

  const d = data || {
    dashboard_count: 0, visualization_count: 0, datasource_count: 0,
    member_count: 0, queries_30d: 0, ds_by_type: [],
    recent_dashboards: [], recent_visualizations: [],
    popular_dashboards: [], trending_dashboards: [],
    activity_trend: [] as { day: string; event_count: number }[], most_active_users: [] as { user_id: string; full_name: string; event_count: number }[],
    total_dashboards_org: 0, total_visualizations_org: 0,
  };

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        marginBottom: 24,
        padding: "28px 32px",
        background: "linear-gradient(135deg, #1e3a8a 0%, #2563EB 50%, #3b82f6 100%)",
        borderRadius: 16,
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(37, 99, 235, 0.2)",
      }}>
        {/* Decorative circles */}
        <div style={{
          position: "absolute", top: -40, right: -20,
          width: 180, height: 180, borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.06)",
        }} />
        <div style={{
          position: "absolute", bottom: -50, right: 80,
          width: 120, height: 120, borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.04)",
        }} />
        <div style={{
          position: "absolute", top: 10, right: 160,
          width: 60, height: 60, borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.05)",
        }} />

        <Row align="middle" justify="space-between" style={{ position: "relative", zIndex: 1 }}>
          <Col>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, display: "block", marginBottom: 4 }}>
              {displayOrgName}{isOwner ? " \u00b7 Owner" : isAdmin ? " \u00b7 Admin" : ""}
            </Text>
            <Title level={3} style={{ margin: 0, color: "#ffffff", fontWeight: 700 }}>
              {greeting}, {firstName}!
            </Title>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, marginTop: 6, display: "block" }}>
              {"Here's what's happening with your analytics today."}
            </Text>
          </Col>
          <Col>
            <Space size={10}>
              {isOwnerOrAdmin && (
                <Button
                  size="middle"
                  icon={<DatabaseOutlined />}
                  onClick={() => onNavigate("data-sources")}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    borderColor: "rgba(255,255,255,0.25)",
                    color: "#ffffff",
                    borderRadius: 10,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  Connect Data Source
                </Button>
              )}
              <Button
                size="middle"
                icon={<DashboardOutlined />}
                onClick={() => onNavigate("dashboards")}
                style={{
                  background: "#ffffff",
                  borderColor: "#ffffff",
                  color: "#1e3a8a",
                  fontWeight: 600,
                  borderRadius: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                }}
              >
                View Dashboards
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* â”€â”€ Stat Cards â”€â”€ */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {isOwner && (
          <>
            <Col xs={24} sm={12} lg={5}>
              <Card bordered style={{ borderColor: "#e2e8f0" }} hoverable onClick={() => onNavigate("dashboards")}>
                <Statistic title="My Dashboards" value={d.dashboard_count} prefix={<DashboardOutlined style={{ color: "#2563EB" }} />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={5}>
              <Card bordered style={{ borderColor: "#e2e8f0" }}>
                <Statistic title="Visualizations" value={d.visualization_count} prefix={<BarChartOutlined style={{ color: "#10b981" }} />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={5}>
              <Card bordered style={{ borderColor: "#e2e8f0" }} hoverable onClick={() => onNavigate("data-sources")}>
                <Statistic title="Data Sources" value={d.datasource_count} prefix={<DatabaseOutlined style={{ color: "#f59e0b" }} />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={5}>
              <Card bordered style={{ borderColor: "#e2e8f0" }} hoverable onClick={() => onNavigate("team")}>
                <Statistic title="Team Members" value={d.member_count} prefix={<TeamOutlined style={{ color: "#3b82f6" }} />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <Card bordered style={{ borderColor: "#e2e8f0" }}>
                <Statistic title="Queries (30d)" value={d.queries_30d} prefix={<ThunderboltOutlined style={{ color: "#8b5cf6" }} />} />
              </Card>
            </Col>
          </>
        )}
        {isAdmin && (
          <>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered style={{ borderColor: "#e2e8f0" }} hoverable onClick={() => onNavigate("dashboards")}>
                <Statistic title="My Dashboards" value={d.dashboard_count} prefix={<DashboardOutlined style={{ color: "#2563EB" }} />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered style={{ borderColor: "#e2e8f0" }}>
                <Statistic title="Visualizations" value={d.visualization_count} prefix={<BarChartOutlined style={{ color: "#10b981" }} />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered style={{ borderColor: "#e2e8f0" }} hoverable onClick={() => onNavigate("data-sources")}>
                <Statistic title="Data Sources" value={d.datasource_count} prefix={<DatabaseOutlined style={{ color: "#f59e0b" }} />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered style={{ borderColor: "#e2e8f0" }}>
                <Statistic title="Queries (30d)" value={d.queries_30d} prefix={<ThunderboltOutlined style={{ color: "#8b5cf6" }} />} />
              </Card>
            </Col>
          </>
        )}
        {!isOwnerOrAdmin && (
          <>
            <Col xs={24} sm={8}>
              <Card bordered style={{ borderColor: "#e2e8f0" }} hoverable onClick={() => onNavigate("dashboards")}>
                <Statistic title="My Dashboards" value={d.dashboard_count} prefix={<DashboardOutlined style={{ color: "#2563EB" }} />} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card bordered style={{ borderColor: "#e2e8f0" }}>
                <Statistic title="Visualizations" value={d.visualization_count} prefix={<BarChartOutlined style={{ color: "#10b981" }} />} />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card bordered style={{ borderColor: "#e2e8f0" }}>
                <Statistic title="Team Size" value={d.member_count} prefix={<TeamOutlined style={{ color: "#3b82f6" }} />} />
              </Card>
            </Col>
          </>
        )}
      </Row>

      {/* â”€â”€ Main Content Grid â”€â”€ */}
      <Row gutter={[16, 16]}>

        {/* â”€â”€ Left Column â”€â”€ */}
        <Col xs={24} lg={isOwnerOrAdmin ? 16 : 14}>

          {/* Recent Dashboards */}
          <Card
            title={<Space><ClockCircleOutlined /> Recent Dashboards</Space>}
            bordered
            style={{ borderColor: "#e2e8f0", marginBottom: 16 }}
            extra={
              d.recent_dashboards.length > 0 ? (
                <Button type="link" size="small" onClick={() => onNavigate("dashboards")}>
                  View All
                </Button>
              ) : null
            }
          >
            {d.recent_dashboards.length > 0 ? (
              <List
                dataSource={d.recent_dashboards}
                renderItem={(item: OverviewDashboardItem) => (
                  <List.Item
                    key={item.id}
                    style={{ cursor: "pointer", padding: "10px 0" }}
                    onClick={() => onNavigate("dashboards")}
                    extra={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.last_viewed ? timeAgo(item.last_viewed) : ""}
                      </Text>
                    }
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          style={{ backgroundColor: "#2563EB" }}
                          icon={<DashboardOutlined />}
                          size="small"
                        />
                      }
                      title={
                        <Space size={4}>
                          <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                          {item.visibility === "public"
                            ? <GlobalOutlined style={{ color: "#10b981", fontSize: 11 }} />
                            : <LockOutlined style={{ color: "#94a3b8", fontSize: 11 }} />
                          }
                        </Space>
                      }
                      description={<Text type="secondary" style={{ fontSize: 12 }}>by {item.creator_name}</Text>}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No recent dashboards"
                style={{ padding: "20px 0" }}
              >
                <Button type="primary" size="small" onClick={() => onNavigate("dashboards")}>
                  Browse Dashboards
                </Button>
              </Empty>
            )}
          </Card>

          {/* Recent Visualizations */}
          <Card
            title={<Space><EyeOutlined /> Recent Visualizations</Space>}
            bordered
            style={{ borderColor: "#e2e8f0", marginBottom: 16 }}
          >
            {d.recent_visualizations.length > 0 ? (
              <List
                dataSource={d.recent_visualizations}
                renderItem={(item: OverviewVisualizationItem) => (
                  <List.Item
                    key={item.id}
                    style={{ padding: "10px 0" }}
                    extra={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.last_viewed ? timeAgo(item.last_viewed) : ""}
                      </Text>
                    }
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          style={{ backgroundColor: "#10b981" }}
                          icon={CHART_ICONS[item.chart_type] || <BarChartOutlined />}
                          size="small"
                        />
                      }
                      title={
                        <Space size={4}>
                          <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                          <Tag color="green" style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px" }}>
                            {item.chart_type}
                          </Tag>
                        </Space>
                      }
                      description={<Text type="secondary" style={{ fontSize: 12 }}>by {item.creator_name}</Text>}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No recent visualizations"
                style={{ padding: "20px 0" }}
              />
            )}
          </Card>

          {/* Owner/Admin: Activity Trend */}
          {isOwnerOrAdmin && d.activity_trend.length > 0 && (
            <Card
              title={<Space><RiseOutlined /> Daily Active Users (7 days)</Space>}
              bordered
              style={{ borderColor: "#e2e8f0", marginBottom: 16 }}
            >
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, padding: "0 8px" }}>
                {(() => {
                  const maxVal = Math.max(...d.activity_trend.map((t) => t.event_count), 1);
                  return d.activity_trend.map((t, i) => {
                    const pct = (t.event_count / maxVal) * 100;
                    const dayLabel = new Date(t.day + "T00:00:00").toLocaleDateString("en", { weekday: "short" });
                    return (
                      <Tooltip key={i} title={`${dayLabel}: ${t.event_count} ${t.event_count === 1 ? "user" : "users"}`}>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <Text style={{ fontSize: 11, color: "#2563EB", fontWeight: 600 }}>
                            {t.event_count}
                          </Text>
                          <div
                            style={{
                              width: "100%",
                              maxWidth: 50,
                              height: `${Math.max(pct, 4)}%`,
                              background: "linear-gradient(180deg, #2563EB 0%, #3b82f6 100%)",
                              borderRadius: 4,
                              minHeight: 4,
                              transition: "height 0.3s",
                            }}
                          />
                          <Text style={{ fontSize: 10, color: "#94a3b8" }}>{dayLabel}</Text>
                        </div>
                      </Tooltip>
                    );
                  });
                })()}
              </div>
            </Card>
          )}

          {/* Owner/Admin: Org-wide stats */}
          {isOwnerOrAdmin && (
            <Card
              title={<Space><BarChartOutlined /> Organization Analytics</Space>}
              bordered
              style={{ borderColor: "#e2e8f0", marginBottom: 16 }}
            >
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Statistic
                    title="Total Dashboards"
                    value={d.total_dashboards_org}
                    prefix={<DashboardOutlined style={{ color: "#2563EB" }} />}
                    valueStyle={{ fontSize: 20 }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Total Visualizations"
                    value={d.total_visualizations_org}
                    prefix={<BarChartOutlined style={{ color: "#10b981" }} />}
                    valueStyle={{ fontSize: 20 }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Team Members"
                    value={d.member_count}
                    prefix={<TeamOutlined style={{ color: "#3b82f6" }} />}
                    valueStyle={{ fontSize: 20 }}
                  />
                </Col>
              </Row>
              {d.ds_by_type.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: "block" }}>
                    Data Sources by Type
                  </Text>
                  <Space wrap>
                    {d.ds_by_type.map((ds) => (
                      <Tag
                        key={ds.ds_type}
                        color={DS_TYPE_COLORS[ds.ds_type] || "#94a3b8"}
                        style={{ fontSize: 12, padding: "2px 10px" }}
                      >
                        {ds.ds_type.toUpperCase()} {ds.count}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
            </Card>
          )}
        </Col>

        {/* ── Right Column ── */}
        <Col xs={24} lg={isOwnerOrAdmin ? 8 : 10}>

          {/* Trending This Week */}
          <Card
            title={
              <Space>
                <FireOutlined style={{ color: "#f5222d" }} />
                <span>Trending This Week</span>
              </Space>
            }
            bordered
            style={{ borderColor: "#e2e8f0", marginBottom: 16 }}
          >
            {d.trending_dashboards.length > 0 ? (
              <List
                dataSource={d.trending_dashboards}
                renderItem={(item: OverviewDashboardItem, index: number) => (
                  <List.Item
                    key={item.id}
                    style={{ cursor: "pointer", padding: "8px 0" }}
                    onClick={() => onNavigate("dashboards")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
                      <Badge
                        count={index + 1}
                        style={{
                          backgroundColor: index === 0 ? "#f5222d" : index === 1 ? "#fa8c16" : "#94a3b8",
                          fontSize: 10,
                          minWidth: 20,
                          height: 20,
                          lineHeight: "20px",
                        }}
                      />
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <Text strong style={{ fontSize: 13, display: "block" }} ellipsis>
                          {item.title}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {item.views_this_week} views this week
                        </Text>
                      </div>
                      <FireOutlined style={{ color: "#f5222d", fontSize: 12 }} />
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No trending dashboards yet"
                style={{ padding: "16px 0" }}
              />
            )}
          </Card>

          {/* Popular Dashboards */}
          <Card
            title={
              <Space>
                <TrophyOutlined style={{ color: "#fa8c16" }} />
                <span>Popular Dashboards</span>
              </Space>
            }
            bordered
            style={{ borderColor: "#e2e8f0", marginBottom: 16 }}
          >
            {d.popular_dashboards.length > 0 ? (
              <List
                dataSource={d.popular_dashboards}
                renderItem={(item: OverviewDashboardItem) => (
                  <List.Item
                    key={item.id}
                    style={{ cursor: "pointer", padding: "8px 0" }}
                    onClick={() => onNavigate("dashboards")}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          style={{ backgroundColor: "#fa8c16" }}
                          icon={<TrophyOutlined />}
                          size="small"
                        />
                      }
                      title={<Text strong style={{ fontSize: 13 }}>{item.title}</Text>}
                      description={
                        <Space size={12}>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <EyeOutlined /> {item.view_count} views
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            <UserOutlined /> {item.unique_users} users
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No popular dashboards yet"
                style={{ padding: "16px 0" }}
              />
            )}
          </Card>

          {/* Owner: Most Active Users */}
          {isOwner && d.most_active_users.length > 0 && (
            <Card
              title={<Space><TrophyOutlined style={{ color: "#3b82f6" }} /> Most Active Users</Space>}
              bordered
              style={{ borderColor: "#e2e8f0", marginBottom: 16 }}
            >
              <List
                dataSource={d.most_active_users}
                renderItem={(item, index) => {
                  const maxCount = d.most_active_users[0]?.event_count || 1;
                  return (
                    <List.Item key={item.user_id} style={{ padding: "8px 0" }}>
                      <div style={{ width: "100%" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <Space size={6}>
                            <Avatar size="small" style={{ backgroundColor: index === 0 ? "#3b82f6" : "#d9d9d9" }}>
                              {item.full_name[0]}
                            </Avatar>
                            <Text style={{ fontSize: 13 }}>{item.full_name}</Text>
                          </Space>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {item.event_count} events
                          </Text>
                        </div>
                        <Progress
                          percent={Math.round((item.event_count / maxCount) * 100)}
                          showInfo={false}
                          strokeColor="#3b82f6"
                          size="small"
                        />
                      </div>
                    </List.Item>
                  );
                }}
              />
            </Card>
          )}

          {/* Quick Actions */}
          <Card
            title="Quick Actions"
            bordered
            style={{ borderColor: "#e2e8f0" }}
          >
            <Space direction="vertical" style={{ width: "100%" }} size="small">
              <Button
                block
                icon={<DashboardOutlined />}
                onClick={() => onNavigate("dashboards")}
              >
                Browse Dashboards
              </Button>
              {isOwnerOrAdmin && (
                <>
                  <Button
                    block
                    icon={<DatabaseOutlined />}
                    onClick={() => onNavigate("data-sources")}
                  >
                    Connect Data Source
                  </Button>
                  <Button
                    block
                    icon={<SearchOutlined />}
                    onClick={() => onNavigate("queries")}
                  >
                    Run Queries
                  </Button>
                </>
              )}
              {isOwner && (
                <Button
                  block
                  icon={<TeamOutlined />}
                  onClick={() => onNavigate("team")}
                >
                  Manage Team
                </Button>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
