import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env";

import adminRoutes from "./routes/admin";
import businessRoutes from "./routes/business";
import paymentRoutes from "./routes/payment";
import payoutRoutes from "./routes/payout";
import redemptionRoutes from "./routes/redemption";
import referralRoutes from "./routes/referral";
import studentRoutes from "./routes/student";

const app = express();

app.set("trust proxy", 1);
app.use(helmet());

/*
 * CORS: only the configured frontend origins may call the API with
 * credentials/headers. If no origin is configured (e.g. very first
 * deploy), fall back to allowing all so health checks still work.
 */
const allowedOrigins = env.frontendOrigins;

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / server-to-server requests with no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

/*
 * Health checks (used by Render).
 */
app.get("/", (_req, res) => {
  res.json({ service: "sbc-backend", status: "ok" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

/*
 * API routes — paths mirror the original Next.js API routes so the
 * frontend only needs to prefix them with the backend base URL.
 */
app.use("/api/admin", adminRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/payout", payoutRoutes);
app.use("/api/redemption", redemptionRoutes);
app.use("/api/referral", referralRoutes);
app.use("/api/student", studentRoutes);

/*
 * 404 for unknown routes.
 */
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Not found." });
});

/*
 * Central error handler.
 */
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error.";
  if (message.startsWith("Origin not allowed by CORS")) {
    return res.status(403).json({ success: false, error: message });
  }
  console.error("Unhandled error:", err);
  return res
    .status(500)
    .json({ success: false, error: "Internal server error." });
});

app.listen(env.port, () => {
  console.log(`SBC backend listening on port ${env.port} [${env.nodeEnv}]`);
});

export default app;
