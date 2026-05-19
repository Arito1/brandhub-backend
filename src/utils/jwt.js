const jwt = require("jsonwebtoken");

/**
 * Generate a signed JWT for a given user ID.
 * @param {string} userId - MongoDB ObjectId as string
 * @returns {string} signed JWT
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

/**
 * Verify a JWT and return its decoded payload.
 * Throws JsonWebTokenError / TokenExpiredError on failure.
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

module.exports = { generateToken, verifyToken };
