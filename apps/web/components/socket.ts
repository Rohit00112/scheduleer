"use client";

import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000/realtime";

let socket: Socket | null = null;
let socketToken: string | null = null;

export function getSocket(token: string): Socket {
  if (socket && socketToken === token) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(WS_URL, {
    transports: ["websocket"],
    auth: {
      token
    }
  });
  socketToken = token;

  return socket;
}

export function closeSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
}
