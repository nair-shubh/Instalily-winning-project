"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type SystemState =
  | "IDLE"
  | "STREAMING"
  | "BASELINED"
  | "ARMED"
  | "COOLDOWN";

export interface ActivityMsg {
  type: "activity";
  timestamp_ms: number;
  state: SystemState;
  observed_count: number | null;
  baseline_count: number | null;
  diff: number;
  discrepancy_streak: number;
  cooldown_remaining_sec: number;
  average_conf: number;
  detections_count: number;
}

export interface AlertMsg {
  type: "alert";
  timestamp_ms: number;
  message: string;
  diff: number;
  baseline_count: number;
  observed_count: number;
}

export interface EventMsg {
  type: "event";
  timestamp_ms: number;
  event: string;
  payload?: Record<string, unknown>;
}

export interface GemmaMsg {
  type: "gemma_decision";
  action: "trigger_alert" | "ignore_event" | "rebaseline";
  raw_output: string;
  severity?: string;
  message?: string;
  reason?: string;
  new_count?: number;
}

export type WsMessage = ActivityMsg | AlertMsg | EventMsg | GemmaMsg;

export interface DashboardState {
  connected: boolean;
  activity: ActivityMsg | null;
  alerts: AlertMsg[];
  events: EventMsg[];
  gemmaDecisions: GemmaMsg[];
}

function deriveWsUrl(): string {
  if (typeof window === "undefined") return "";
  const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
  // Connect directly to FastAPI (default port 8000)
  const apiUrl = process.env.NEXT_PUBLIC_API_WS_URL ??
    `${wsProto}://${window.location.hostname}:8000`;
  return `${apiUrl}/ws/dashboard`;
}

export function useDashboardWs(): DashboardState {
  const [state, setState] = useState<DashboardState>({
    connected: false,
    activity: null,
    alerts: [],
    events: [],
    gemmaDecisions: [],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const url = deriveWsUrl();
    if (!url) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setState((s) => ({ ...s, connected: true }));

    ws.onclose = () => {
      setState((s) => ({ ...s, connected: false }));
      reconnectTimer.current = setTimeout(connect, 1500);
    };

    ws.onerror = () => {
      setState((s) => ({ ...s, connected: false }));
    };

    ws.onmessage = (evt) => {
      let msg: WsMessage;
      try {
        msg = JSON.parse(evt.data) as WsMessage;
      } catch {
        return;
      }

      setState((prev) => {
        if (msg.type === "activity") {
          return { ...prev, activity: msg as ActivityMsg };
        }
        if (msg.type === "alert") {
          return {
            ...prev,
            alerts: [msg as AlertMsg, ...prev.alerts].slice(0, 50),
          };
        }
        if (msg.type === "event") {
          return {
            ...prev,
            events: [msg as EventMsg, ...prev.events].slice(0, 100),
          };
        }
        if (msg.type === "gemma_decision") {
          return {
            ...prev,
            gemmaDecisions: [msg as GemmaMsg, ...prev.gemmaDecisions].slice(0, 30),
          };
        }
        return prev;
      });
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return state;
}
