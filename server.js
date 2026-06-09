require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("./config/db");
const { initSocket } = require("./socket/socketHandler");

const PORT = process.env.PORT || 5000;

// ── Create HTTP server ────────────────────────────────────────────────────────
const server = http.createServer(app);

// ── Socket.IO setup ───────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL,
      "http://localhost:3000",
      "http://localhost:5173",
    ].filter(Boolean),
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
});

// Attach io instance to app for use in controllers if needed
app.set("io", io);

// Initialise socket handlers
initSocket(io);

// ── Connect DB then start server ──────────────────────────────────────────────
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀  HawkBeak Chat server running in ${process.env.NODE_ENV || "development"} mode`);
    console.log(`📡  HTTP  → http://localhost:${PORT}`);
    console.log(`🔌  WS    → ws://localhost:${PORT}\n`);
  });
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = (signal) => {
  console.log(`\n${signal} received – shutting down gracefully…`);
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err.message);
  shutdown("unhandledRejection");
});
