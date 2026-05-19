const express = require("express");
const router = express.Router();
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  addProductImages,
  getProductsByBrand,
  getMyProducts,
} = require("../controllers/productController");
const { protect, restrictTo } = require("../middleware/auth");

router.get("/", getAllProducts);
router.get("/my/products", protect, restrictTo("brand"), getMyProducts);
router.get("/brand/:brandId", getProductsByBrand);
router.post("/", protect, restrictTo("brand"), createProduct);
router.patch("/:id/images", protect, restrictTo("brand"), addProductImages);
router.patch("/:id", protect, restrictTo("brand"), updateProduct);
router.delete("/:id", protect, restrictTo("brand"), deleteProduct);
router.get("/:id", getProductById);

module.exports = router;
