"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useDebouncedValue } from "@/lib/hooks";
import {
  Button,
  Typography,
  Input,
  Space,
  App,
  Drawer,
  Card,
  Tag,
  Empty,
  Spin,
  Tooltip,
  Radio,
  Popconfirm,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  SaveOutlined,
  SearchOutlined,
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  GlobalOutlined,
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  AreaChartOutlined,
  DotChartOutlined,
  TableOutlined,
  AppstoreOutlined,
  FontSizeOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { ResponsiveGridLayout, type Layout, useContainerWidth, verticalCompactor } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import DashboardWidget from "./DashboardWidget";
import DashboardTextWidget from "./DashboardTextWidget";
import {
  listVisualizationsAction,
  createDashboardAction,
  updateDashboardAction,
  getDashboardAction,
} from "@/lib/actions";
import type {
  VisualizationListItem,
  DashboardDetail,
} from "@/lib/actions";

const { Text, Title } = Typography;

const GRID_COLS = 24;
const ROW_HEIGHT = 40;
const WIDGET_DEFAULTS = { w: 8, h: 8, minW: 4, minH: 4 };
const HEADING_DEFAULTS = { w: 24, h: 1, minW: 4, minH: 1 };
const TEXT_DEFAULTS = { w: 12, h: 2, minW: 4, minH: 1 };

const CHART_ICONS: Record<string, React.ReactNode> = {
  bar: <BarChartOutlined />,
  line: <LineChartOutlined />,
  pie: <PieChartOutlined />,
  area: <AreaChartOutlined />,
  scatter: <DotChartOutlined />,
  table: <TableOutlined />,
};

// â”€â”€ Types â”€â”€

export type WidgetType = "viz" | "heading" | "text";

export interface DashboardTabWidget {
  i: string;          // unique widget id
  type: WidgetType;   // widget type
  vizId?: string;     // visualization id (for viz widgets)
  content?: string;   // text content (for heading/text widgets)
  label?: string;     // custom display title (dashboard-local override)
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardTab {
  id: string;
  name: string;
  widgets: DashboardTabWidget[];
}

export interface DashboardLayoutData {
  tabs: DashboardTab[];
}

function newTabId() {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
function newWidgetId() {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

interface DashboardBuilderProps {
  editingDashboard?: DashboardDetail;
  onBack: () => void;
  onSaved?: () => void;
}

export default function DashboardBuilder({
  editingDashboard,
  onBack,
  onSaved,
}: DashboardBuilderProps) {
  const { message } = App.useApp();
  const isEditing = !!editingDashboard;

  // Dashboard meta
  const [title, setTitle] = useState(editingDashboard?.title || "");
  const [description, setDescription] = useState(editingDashboard?.description || "");
  const [visibility, setVisibility] = useState<"private" | "public">(
    editingDashboard?.visibility || "private"
  );

  // Tabs + widgets
  const [tabs, setTabs] = useState<DashboardTab[]>(() => {
    const raw = editingDashboard?.layout as unknown as DashboardLayoutData | undefined;
    if (raw?.tabs?.length) return raw.tabs;
    return [{ id: newTabId(), name: "Tab 1", widgets: [] }];
  });
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id || "");

  // Viz picker drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vizList, setVizList] = useState<VisualizationListItem[]>([]);
  const [vizLoading, setVizLoading] = useState(false);
  const [vizSearch, setVizSearch] = useState("");
  const debouncedVizSearch = useDebouncedValue(vizSearch, 300);

  // Saving
  const [saving, setSaving] = useState(false);

  // Grid container width
  const { width: containerWidth, containerRef } = useContainerWidth({ initialWidth: 1200 });

  // Editing tab name
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState("");

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0],
    [tabs, activeTabId]
  );

  // â”€â”€ Load visualizations â”€â”€
  const loadVizList = useCallback(async () => {
    setVizLoading(true);
    const result = await listVisualizationsAction();
    if (result.ok && result.data) {
      setVizList(result.data);
    }
    setVizLoading(false);
  }, []);

  useEffect(() => {
    loadVizList();
  }, [loadVizList]);

  const filteredVizList = useMemo(() => {
    if (!debouncedVizSearch.trim()) return vizList;
    const q = debouncedVizSearch.toLowerCase();
    return vizList.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.chart_type.toLowerCase().includes(q) ||
        v.creator_name.toLowerCase().includes(q)
    );
  }, [vizList, debouncedVizSearch]);

  // â”€â”€ Tab operations â”€â”€
  const addTab = () => {
    const id = newTabId();
    const newTab: DashboardTab = { id, name: `Tab ${tabs.length + 1}`, widgets: [] };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
  };

  const removeTab = (tabId: string) => {
    if (tabs.length <= 1) {
      message.warning("Dashboard must have at least one tab");
      return;
    }
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(next[0]?.id || "");
      }
      return next;
    });
  };

  const renameTab = (tabId: string, name: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, name: name || t.name } : t))
    );
    setEditingTabId(null);
  };

  // â”€â”€ Widget operations â”€â”€
  const addWidget = (vizId: string) => {
    const widgetId = newWidgetId();
    const maxY = activeTab.widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);
    const newWidget: DashboardTabWidget = {
      i: widgetId,
      type: "viz",
      vizId,
      x: 0,
      y: maxY,
      w: WIDGET_DEFAULTS.w,
      h: WIDGET_DEFAULTS.h,
    };
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, widgets: [...t.widgets, newWidget] }
          : t
      )
    );
  };

  const addTextWidget = (type: "heading" | "text") => {
    const widgetId = newWidgetId();
    const maxY = activeTab.widgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);
    const defaults = type === "heading" ? HEADING_DEFAULTS : TEXT_DEFAULTS;
    const newWidget: DashboardTabWidget = {
      i: widgetId,
      type,
      content: "",
      x: 0,
      y: maxY,
      w: defaults.w,
      h: defaults.h,
    };
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, widgets: [...t.widgets, newWidget] }
          : t
      )
    );
  };

  const updateWidgetContent = (widgetId: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              widgets: t.widgets.map((w) =>
                w.i === widgetId ? { ...w, content } : w
              ),
            }
          : t
      )
    );
  };

  const updateWidgetLabel = (widgetId: string, label: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              widgets: t.widgets.map((w) =>
                w.i === widgetId ? { ...w, label: label || undefined } : w
              ),
            }
          : t
      )
    );
  };

  const removeWidget = (widgetId: string) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, widgets: t.widgets.filter((w) => w.i !== widgetId) }
          : t
      )
    );
  };

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeTabId) return t;
          const updated = t.widgets.map((w) => {
            const item = newLayout.find((l) => l.i === w.i);
            if (!item) return w;
            if (w.x === item.x && w.y === item.y && w.w === item.w && w.h === item.h) return w;
            return { ...w, x: item.x, y: item.y, w: item.w, h: item.h };
          });
          return { ...t, widgets: updated };
        })
      );
    },
    [activeTabId]
  );

  // â”€â”€ Save â”€â”€
  const handleSave = async () => {
    if (!title.trim()) {
      message.warning("Please enter a dashboard title");
      return;
    }
    setSaving(true);
    try {
      const layoutData: DashboardLayoutData = { tabs };
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        layout: JSON.parse(JSON.stringify(layoutData)) as Record<string, unknown>,
        visibility,
      };
      console.log("[DashboardBuilder] saving payload:", JSON.stringify(payload).slice(0, 500));
      if (isEditing && editingDashboard) {
        const result = await updateDashboardAction(editingDashboard.id, payload);
        console.log("[DashboardBuilder] update result:", result);
        if (result.ok) {
          message.success("Dashboard saved!");
          onSaved?.();
        } else {
          message.error(result.error || "Failed to save");
        }
      } else {
        const result = await createDashboardAction(payload);
        console.log("[DashboardBuilder] create result:", result);
        if (result.ok) {
          message.success("Dashboard created!");
          onSaved?.();
        } else {
          message.error(result.error || "Failed to create");
        }
      }
    } catch (err) {
      console.error("[DashboardBuilder] handleSave error:", err);
      message.error("Unexpected error saving dashboard");
    } finally {
      setSaving(false);
    }
  };

  // â”€â”€ Grid layout items (memoized to prevent re-init) â”€â”€
  const gridLayout: Layout = useMemo(
    () =>
      activeTab.widgets.map((w) => {
        const defaults =
          w.type === "heading"
            ? HEADING_DEFAULTS
            : w.type === "text"
              ? TEXT_DEFAULTS
              : WIDGET_DEFAULTS;
        return {
          i: w.i,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          minW: defaults.minW,
          minH: defaults.minH,
        };
      }),
    [activeTab.widgets]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* â”€â”€ Top Bar â”€â”€ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 0",
          borderBottom: "1px solid #f0f0f0",
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Dashboard title..."
          variant="borderless"
          style={{ fontSize: 18, fontWeight: 600, flex: 1, maxWidth: 400 }}
          maxLength={255}
        />
        <div style={{ flex: 1 }} />
        <Radio.Group
          size="small"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
        >
          <Radio.Button value="private">
            <LockOutlined /> Private
          </Radio.Button>
          <Radio.Button value="public">
            <GlobalOutlined /> Public
          </Radio.Button>
        </Radio.Group>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
        >
          {isEditing ? "Save" : "Create"}
        </Button>
      </div>

      {/* Description */}
      <Input.TextArea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Optional description..."
        autoSize={{ minRows: 1, maxRows: 2 }}
        variant="borderless"
        style={{ marginBottom: 12, maxWidth: 600, fontSize: 13, color: "#666" }}
      />

      {/* â”€â”€ Tabs Bar â”€â”€ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          borderBottom: "2px solid #f0f0f0",
          marginBottom: 12,
          flexShrink: 0,
          overflowX: "auto",
          paddingBottom: 0,
        }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 14px",
              cursor: "pointer",
              borderBottom: activeTabId === tab.id ? "2px solid #4F6CF7" : "2px solid transparent",
              marginBottom: -2,
              color: activeTabId === tab.id ? "#4F6CF7" : "#666",
              fontWeight: activeTabId === tab.id ? 600 : 400,
              fontSize: 13,
              transition: "all 0.2s",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
            onClick={() => setActiveTabId(tab.id)}
          >
            {editingTabId === tab.id ? (
              <Input
                size="small"
                value={editingTabName}
                onChange={(e) => setEditingTabName(e.target.value)}
                onPressEnter={() => renameTab(tab.id, editingTabName)}
                onBlur={() => renameTab(tab.id, editingTabName)}
                autoFocus
                style={{ width: 100, fontSize: 13 }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingTabId(tab.id);
                  setEditingTabName(tab.name);
                }}
              >
                {tab.name}
              </span>
            )}
            {tabs.length > 1 && (
              <Popconfirm
                title="Remove this tab?"
                onConfirm={(e) => {
                  e?.stopPropagation();
                  removeTab(tab.id);
                }}
                onCancel={(e) => e?.stopPropagation()}
                okText="Yes"
                cancelText="No"
              >
                <DeleteOutlined
                  style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            )}
          </div>
        ))}
        <Tooltip title="Add tab">
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={addTab}
            style={{ marginLeft: 4, color: "#999" }}
          />
        </Tooltip>
        <div style={{ flex: 1 }} />
        <Space size={4} style={{ marginBottom: 4 }}>
          <Tooltip title="Add a heading">
            <Button
              type="dashed"
              icon={<FontSizeOutlined />}
              onClick={() => addTextWidget("heading")}
              size="small"
            >
              Heading
            </Button>
          </Tooltip>
          <Tooltip title="Add a text block">
            <Button
              type="dashed"
              icon={<FileTextOutlined />}
              onClick={() => addTextWidget("text")}
              size="small"
            >
              Text
            </Button>
          </Tooltip>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setDrawerOpen(true)}
            size="small"
          >
            Add Visualization
          </Button>
        </Space>
      </div>

      {/* â”€â”€ Grid Area â”€â”€ */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: "auto",
          borderRadius: 8,
          padding: "8px 0",
          minHeight: 400,
          position: "relative",
          backgroundImage:
            `linear-gradient(to right, #e8eaed 1px, transparent 1px), linear-gradient(to bottom, #e8eaed 1px, transparent 1px)`,
          backgroundSize: `${(containerWidth - 24 + 12) / GRID_COLS}px ${ROW_HEIGHT + 12}px`,
          backgroundPosition: "12px 12px",
          backgroundColor: "#fafbfc",
        }}
      >
        {activeTab.widgets.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: 400,
              color: "#999",
            }}
          >
            <AppstoreOutlined style={{ fontSize: 48, marginBottom: 16, color: "#d9d9d9" }} />
            <Text type="secondary" style={{ fontSize: 15 }}>
              Add visualizations, headings, or text to start building your dashboard
            </Text>
            <Space style={{ marginTop: 12 }}>
              <Button
                type="dashed"
                icon={<FontSizeOutlined />}
                onClick={() => addTextWidget("heading")}
              >
                Add Heading
              </Button>
              <Button
                type="dashed"
                icon={<FileTextOutlined />}
                onClick={() => addTextWidget("text")}
              >
                Add Text
              </Button>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => setDrawerOpen(true)}
              >
                Add Visualization
              </Button>
            </Space>
          </div>
        ) : (
          <ResponsiveGridLayout
            className="layout"
            width={containerWidth}
            layouts={{ lg: gridLayout }}
            breakpoints={{ lg: 1200, md: 996, sm: 768 }}
            cols={{ lg: GRID_COLS, md: 18, sm: 12 }}
            rowHeight={ROW_HEIGHT}
            dragConfig={{ enabled: true, handle: ".drag-handle" }}
            resizeConfig={{ enabled: true }}
            onLayoutChange={(layout: Layout) => handleLayoutChange(layout)}
            compactor={verticalCompactor}
            margin={[12, 12]}
            containerPadding={[12, 12]}
          >
            {activeTab.widgets.map((w) => (
              <div
                key={w.i}
                style={{
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #e8e8e8",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  overflow: "hidden",
                }}
              >
                {w.type === "heading" || w.type === "text" ? (
                  <DashboardTextWidget
                    type={w.type}
                    content={w.content || ""}
                    editing={true}
                    onContentChange={(c) => updateWidgetContent(w.i, c)}
                    onRemove={() => removeWidget(w.i)}
                  />
                ) : (
                  <DashboardWidget
                    vizId={w.vizId!}
                    editing={true}
                    label={w.label}
                    dashboardId={editingDashboard?.id}
                    onLabelChange={(label) => updateWidgetLabel(w.i, label)}
                    onRemove={() => removeWidget(w.i)}
                  />
                )}
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>

      {/* â”€â”€ Visualization Picker Drawer â”€â”€ */}
      <Drawer
        title="Add Visualization"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={400}
        styles={{ body: { padding: "12px 16px" } }}
      >
        <Input
          placeholder="Search visualizations..."
          prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
          allowClear
          value={vizSearch}
          onChange={(e) => setVizSearch(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        {vizLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin />
          </div>
        ) : filteredVizList.length === 0 ? (
          <Empty description="No visualizations found" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredVizList.map((v) => {
              const alreadyAdded = activeTab.widgets.some((w) => w.vizId === v.id);
              return (
                <Card
                  key={v.id}
                  size="small"
                  hoverable={!alreadyAdded}
                  style={{
                    borderColor: alreadyAdded ? "#d9d9d9" : "#e2e8f0",
                    opacity: alreadyAdded ? 0.55 : 1,
                    cursor: alreadyAdded ? "default" : "pointer",
                  }}
                  onClick={() => {
                    if (!alreadyAdded) {
                      addWidget(v.id);
                      message.success(`Added "${v.title}"`);
                    }
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 18, color: "#4F6CF7" }}>
                      {CHART_ICONS[v.chart_type] || <BarChartOutlined />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ fontSize: 13, display: "block" }} ellipsis>
                        {v.title}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {v.chart_type} &middot; {v.creator_name}
                      </Text>
                    </div>
                    <div>
                      {v.visibility === "public" ? (
                        <Tag color="green" style={{ margin: 0, fontSize: 11 }}>Public</Tag>
                      ) : (
                        <Tag style={{ margin: 0, fontSize: 11 }}>Private</Tag>
                      )}
                    </div>
                    {alreadyAdded && (
                      <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>Added</Tag>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Drawer>

      <style jsx global>{`
        .react-grid-item.react-grid-placeholder {
          background: #4F6CF7 !important;
          opacity: 0.15 !important;
          border-radius: 8px !important;
        }
        .react-grid-item > .react-resizable-handle {
          width: 14px !important;
          height: 14px !important;
        }
        .react-grid-item > .react-resizable-handle::after {
          border-right: 2px solid rgba(0,0,0,0.2) !important;
          border-bottom: 2px solid rgba(0,0,0,0.2) !important;
        }
      `}</style>
    </div>
  );
}
