require("dotenv").config();
const http = require("http");
const { validateEnv } = require("./config/env");
const app = require("./app");
const connectDB = require("./config/db");
const { initWebSocket } = require("./websocket/wsManager");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  validateEnv();
  await connectDB();

  const httpServer = http.createServer(app);

  initWebSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`\n BrandHub server running on port ${PORT}`);
    console.log(` WebSocket ready on ws://localhost:${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV || "development"}\n`);
  });
};

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
