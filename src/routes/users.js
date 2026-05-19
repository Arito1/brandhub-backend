const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { getOnlineUsers } = require("../websocket/wsManager");
const { sendSuccess } = require("../utils/helpers");

/**
 * GET /api/users/online
 */
router.get("/online", protect, (req, res) => {
  return sendSuccess(res, 200, "Online users retrieved.", {
    onlineUsers: getOnlineUsers(),
    count: getOnlineUsers().length,
  });
});

module.exports = router;
