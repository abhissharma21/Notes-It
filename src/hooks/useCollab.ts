import { useEffect, useRef, useState } from "react";
import type { EditorOp, RemoteCursor, CollabMessage } from "../types";

export function useCollab(onRemoteOp: (op: EditorOp) => void) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [myInfo, setMyInfo] = useState<{ id: string; color: string; name: string } | null>(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080");
    ws.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as CollabMessage;
        
        if (msg.type === "init") {
          setMyInfo(msg.payload);
        } else if (msg.type === "op") {
          onRemoteOp(msg.payload);
        } else if (msg.type === "cursor") {
          setRemoteCursors(prev => ({
            ...prev,
            [msg.payload.clientId]: { ...msg.payload, lastActive: Date.now() }
          }));
        } else if (msg.type === "client_disconnect") {
          setRemoteCursors(prev => {
            const next = { ...prev };
            delete next[msg.payload.clientId];
            return next;
          });
        }
      } catch (e) {
        console.error(e);
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      socket.close();
    };
  }, []);

  const broadcastOp = (op: EditorOp) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: "op", payload: op }));
    }
  };

  const broadcastCursor = (blockId: string, offset: number) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && myInfo) {
      ws.current.send(JSON.stringify({
        type: "cursor",
        payload: { blockId, offset }
      }));
    }
  };

  return { isConnected, broadcastOp, broadcastCursor, remoteCursors };
}