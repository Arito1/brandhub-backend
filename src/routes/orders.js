const express = require("express");
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  getBrandOrders,
} = require("../controllers/orderController");
const { protect, restrictTo } = require("../middleware/auth");

router.use(protect); 

router.post("/", restrictTo("customer"), createOrder);
router.get("/my", restrictTo("customer"), getMyOrders);
router.get("/brand", restrictTo("brand"), getBrandOrders);
router.get("/:id", getOrderById);
router.patch("/:id/status", restrictTo("brand"), updateOrderStatus);

module.exports = router;
