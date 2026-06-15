import type { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | null = null;

/** Enregistre l'instance Socket.io (appelé une fois depuis index.ts). */
export function setIo(instance: SocketIOServer): void {
  io = instance;
}

/** Instance Socket.io pour émettre les événements temps réel depuis les routers. */
export function getIo(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.io non initialisé");
  }
  return io;
}
