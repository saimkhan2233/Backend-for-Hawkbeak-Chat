require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const groupRoutes = require("./routes/groupRoutes");
const messageRoutes = require("./routes/messageRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:3000",
  "http://localhost:5173",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ── Sanitize MongoDB queries ──────────────────────────────────────────────────
app.use(mongoSanitize());

// ── HTTP logging (skip in test) ───────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Static uploads (local fallback) ──────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", app: "HawkBeak Chat API", timestamp: new Date() });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
