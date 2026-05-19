const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const { sendError } = require("../utils/helpers");


const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return sendError(res, 401, "Not authenticated. Please log in.");
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id);

    if (!user) {
      return sendError(res, 401, "User no longer exists.");
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return sendError(res, 401, "Session expired. Please log in again.");
    }
    return sendError(res, 401, "Invalid token.");
  }
};


const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendError(
        res,
        403,
        `Access denied. Required role: ${roles.join(" or ")}.`
      );
    }
    next();
  };
};

module.exports = { protect, restrictTo };
