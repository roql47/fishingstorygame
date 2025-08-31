import { io } from "socket.io-client";

const serverUrl =
  import.meta.env.VITE_SERVER_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:4000");

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(serverUrl, {
      transports: ["websocket"],
    });
  }
  return socket;
}
