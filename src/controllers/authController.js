const User = require("../models/User");
const { generateToken } = require("../utils/jwt");
const { sendSuccess, sendError } = require("../utils/helpers");
const { broadcastAll, broadcastToUser } = require("../websocket/wsManager");

const publicUser = (user) => (typeof user.toJSON === "function" ? user.toJSON() : user);

/** POST /api/auth/register */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return sendError(res, 400, "Name, email and password are required.");
    }

    const allowedRoles = ["customer", "brand"];
    const userRole = allowedRoles.includes(role) ? role : "customer";

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return sendError(res, 409, "Email already registered.");
    }

    const user = await User.create({ name, email, password, role: userRole });
    const token = generateToken(user._id);

    return sendSuccess(res, 201, "Registration successful.", { user: publicUser(user), token });
  } catch (error) {
    next(error);
  }
};

/** POST /api/auth/login */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 400, "Email and password are required.");
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return sendError(res, 401, "Invalid email or password.");
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    return sendSuccess(res, 200, "Login successful.", { user: publicUser(user), token });
  } catch (error) {
    next(error);
  }
};

/** GET /api/auth/me */
const getMe = async (req, res) => {
  return sendSuccess(res, 200, "User profile retrieved.", { user: req.user });
};

/** POST /api/auth/logout */
const logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      isOnline: false,
      lastSeen: new Date(),
    });
    broadcastAll({ type: "ONLINE_USERS_REFRESH", payload: {} });
    return sendSuccess(res, 200, "Logged out successfully.");
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/auth/avatar */
const updateAvatar = async (req, res, next) => {
  try {
    const { avatarUrl } = req.body;
    if (!avatarUrl) return sendError(res, 400, "avatarUrl is required.");

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true, runValidators: true }
    );

    broadcastToUser(req.user._id, { type: "USER_AVATAR_UPDATED", payload: { user } });

    return sendSuccess(res, 200, "Avatar updated.", { user });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, logout, updateAvatar };
