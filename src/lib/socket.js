// src/lib/socket.js
import { io } from "socket.io-client";

const SOCKET_URL = window.__ENV__?.SOCKET_URL || "";
export function connectSocket(tenantId) {
  const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
  socket.on("connect", () => {
    // join theo tenant để nhận đúng luồng
    socket.emit("join", { tenantId });
  });
  return socket;
}
