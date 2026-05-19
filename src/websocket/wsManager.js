const { WebSocketServer } = require("ws");
const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const Brand = require("../models/Brand");

const OPEN = 1;
const userSockets = new Map();
const brandSockets = new Map();
const onlineUsers = new Set();

let wss;

const safeSend = (ws, message) => {
  if (ws.readyState !== OPEN) return;
  ws.send(typeof message === "string" ? message : JSON.stringify(message));
};

const registerUserSocket = (userId, ws) => {
  const key = userId.toString();
  if (!userSockets.has(key)) userSockets.set(key, new Set());
  userSockets.get(key).add(ws);
  onlineUsers.add(key);
};

const unregisterUserSocket = async (userId, ws) => {
  const key = userId.toString();
  const sockets = userSockets.get(key);
  sockets?.delete(ws);

  if (!sockets || sockets.size === 0) {
    userSockets.delete(key);
    onlineUsers.delete(key);
    await User.findByIdAndUpdate(key, { isOnline: false, lastSeen: new Date() }).catch(() => undefined);
  }
};

const registerBrandSocket = (brandId, ws) => {
  const key = brandId.toString();
  ws.brandId = key;
  if (!brandSockets.has(key)) brandSockets.set(key, new Set());
  brandSockets.get(key).add(ws);
};

const unregisterBrandSocket = (brandId, ws) => {
  const key = brandId.toString();
  const sockets = brandSockets.get(key);
  sockets?.delete(ws);
  if (!sockets || sockets.size === 0) brandSockets.delete(key);
};

const attachBrandToUserSockets = (userId, brandId) => {
  const sockets = userSockets.get(userId.toString());
  if (!sockets) return;
  sockets.forEach((ws) => registerBrandSocket(brandId, ws));
};

/**
 * Initialize the WebSocket server on the existing Express HTTP server.
 * @param {import('http').Server} httpServer
 */
const initWebSocket = (httpServer) => {
  wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", async (ws, req) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const token = url.searchParams.get("token");

      if (!token) {
        ws.close(1008, "Authentication required.");
        return;
      }

      let userId;
      try {
        const decoded = verifyToken(token);
        userId = decoded.id;
      } catch {
        ws.close(1008, "Invalid or expired token.");
        return;
      }

      const user = await User.findById(userId).select("name role avatar");
      if (!user) {
        ws.close(1008, "User not found.");
        return;
      }

      ws.userId = user._id.toString();
      ws.userRole = user.role;
      ws.userName = user.name;

      registerUserSocket(user._id, ws);

      if (user.role === "brand") {
        const brand = await Brand.findOne({ owner: user._id }).select("_id");
        if (brand) registerBrandSocket(brand._id, ws);
      }

      await User.findByIdAndUpdate(user._id, { isOnline: true, lastSeen: new Date() });
      broadcastOnlineUsers();

      safeSend(ws, {
        type: "CONNECTED",
        payload: { userId: user._id.toString(), name: user.name, role: user.role },
      });

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "PING") safeSend(ws, { type: "PONG", payload: { at: new Date().toISOString() } });
        } catch {
          safeSend(ws, { type: "ERROR", payload: { message: "Invalid websocket message format." } });
        }
      });

      ws.on("close", async () => {
        await unregisterUserSocket(user._id, ws);
        if (ws.brandId) unregisterBrandSocket(ws.brandId, ws);
        broadcastOnlineUsers();
      });

      ws.on("error", (err) => {
        console.error(`WebSocket error for user ${user._id}:`, err.message);
      });
    } catch (error) {
      console.error("WebSocket connection error:", error.message);
      ws.close(1011, "Server error.");
    }
  });

  console.log("WebSocket server initialized.");
};

const broadcastToUser = (userId, message) => {
  const sockets = userSockets.get(userId.toString());
  if (!sockets) return;
  const payload = JSON.stringify(message);
  sockets.forEach((ws) => safeSend(ws, payload));
};

const broadcastToBrand = (brandId, message) => {
  const sockets = brandSockets.get(brandId.toString());
  if (!sockets) return;
  const payload = JSON.stringify(message);
  sockets.forEach((ws) => safeSend(ws, payload));
};

const broadcastAll = (message) => {
  if (!wss) return;
  const payload = JSON.stringify(message);
  wss.clients.forEach((ws) => safeSend(ws, payload));
};

const broadcastOnlineUsers = () => {
  broadcastAll({
    type: "ONLINE_USERS",
    payload: { userIds: Array.from(onlineUsers), count: onlineUsers.size },
  });
};

const getOnlineUsers = () => Array.from(onlineUsers);

module.exports = {
  initWebSocket,
  broadcastToUser,
  broadcastToBrand,
  broadcastAll,
  broadcastOnlineUsers,
  getOnlineUsers,
  attachBrandToUserSockets,
};
