"use client";

import { useState, useRef, useEffect } from "react";
import { CloseOutlined, DragOutlined } from "@ant-design/icons";
import type { WidgetType } from "./DashboardBuilder";

interface DashboardTextWidgetProps {
  type: WidgetType; // "heading" | "text"
  content: string;
  editing?: boolean;
  onContentChange?: (content: string) => void;
  onRemove?: () => void;
}

export default function DashboardTextWidget({
  type,
  content,
  editing,
  onContentChange,
  onRemove,
}: DashboardTextWidgetProps) {
  const [localContent, setLocalContent] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external content changes
  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleBlur = () => {
    if (localContent !== content) {
      onContentChange?.(localContent);
    }
  };

  const isHeading = type === "heading";

  if (!editing) {
    // View mode â€” just render the text
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            padding: isHeading ? "12px 16px" : "10px 14px",
            overflow: "hidden",
          }}
        >
          {isHeading ? (
            <h2
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: "#1a1a2e",
                lineHeight: 1.4,
                wordBreak: "break-word",
              }}
            >
              {content || "Untitled"}
            </h2>
          ) : (
            <div
              style={{
                fontSize: 14,
                color: "#374151",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {content || "Empty text"}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Edit mode â€” inline editable
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "stretch",
        overflow: "hidden",
      }}
    >
      {/* Drag handle (left strip) */}
      <div
        className="drag-handle"
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 6px",
          background: "#f8fafc",
          borderRight: "1px solid #f0f0f0",
          cursor: "grab",
        }}
      >
        <DragOutlined style={{ color: "#94a3b8", fontSize: 11 }} />
      </div>

      {/* Editable content */}
      <div style={{ flex: 1, padding: isHeading ? "4px 10px" : "4px 10px", minHeight: 0, display: "flex", alignItems: "center" }}>
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          onBlur={handleBlur}
          placeholder={isHeading ? "Enter heading..." : "Enter text..."}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            outline: "none",
            resize: "none",
            background: "transparent",
            fontSize: isHeading ? 20 : 14,
            fontWeight: isHeading ? 700 : 400,
            color: isHeading ? "#1a1a2e" : "#374151",
            lineHeight: 1.5,
            fontFamily: "inherit",
            padding: 0,
          }}
        />
      </div>

      {/* Remove button (right) */}
      {onRemove && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "0 8px",
          }}
        >
          <CloseOutlined
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            style={{ cursor: "pointer", color: "#999", fontSize: 11 }}
          />
        </div>
      )}
    </div>
  );
}
