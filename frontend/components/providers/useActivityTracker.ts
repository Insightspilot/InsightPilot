"use client";

import { useCallback, useRef, useEffect } from "react";
import { trackActivityAction, trackActivityBatchAction, TrackEventPayload } from "@/lib/actions";

// Generate a session ID that persists for the tab's lifetime
let _sessionId: string | null = null;
function getSessionId(): string {
  if (!_sessionId) {
    _sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return _sessionId;
}

/**
 * Hook for tracking user activity. Batches events and flushes
 * them periodically or on page unload to reduce API calls.
 */
export function useActivityTracker() {
  const buffer = useRef<TrackEventPayload[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (buffer.current.length === 0) return;
    const events = [...buffer.current];
    buffer.current = [];
    try {
      if (events.length === 1) {
        await trackActivityAction(events[0]);
      } else {
        await trackActivityBatchAction(events);
      }
    } catch {
      // Silently fail — tracking should never break UX
    }
  }, []);

  // Flush buffer every 10 seconds
  useEffect(() => {
    timerRef.current = setInterval(() => {
      flush();
    }, 10_000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      flush(); // flush remaining on unmount
    };
  }, [flush]);

  // Flush on page unload
  useEffect(() => {
    const onUnload = () => {
      if (buffer.current.length > 0) {
        // Use sendBeacon for reliability on unload
        flush();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [flush]);

  const track = useCallback(
    (
      eventType: string,
      options?: {
        resourceType?: string;
        resourceId?: string;
        metadata?: Record<string, unknown>;
      }
    ) => {
      const event: TrackEventPayload = {
        event_type: eventType,
        session_id: getSessionId(),
        resource_type: options?.resourceType,
        resource_id: options?.resourceId,
        metadata: options?.metadata,
      };
      buffer.current.push(event);

      // Flush immediately for important events
      const immediateEvents = [
        "dashboard.viewed",
        "visualization.viewed",
        "query.executed",
        "datasource.connected",
      ];
      if (immediateEvents.includes(eventType)) {
        flush();
      }
    },
    [flush]
  );

  return { track };
}
