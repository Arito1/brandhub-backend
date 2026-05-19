/**
 * Send a successful JSON response.
 */
const sendSuccess = (res, statusCode = 200, message = "Success", data = {}) => {
  return res.status(statusCode).json({ success: true, message, data });
};

/**
 * Send an error JSON response.
 */
const sendError = (res, statusCode = 500, message = "Server error", errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

/**
 * Calculate total price from an array of cart items.
 * @param {Array<{price: number, quantity: number}>} items
 * @returns {number}
 */
const calculateTotal = (items) => {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

module.exports = { sendSuccess, sendError, calculateTotal };
