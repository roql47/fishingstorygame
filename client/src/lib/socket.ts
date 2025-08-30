import { io, Socket } from "socket.io-client";

const serverUrl = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(serverUrl, {
      transports: ["websocket"],
    });
  }
  return socket;
}


