const express = require("express");
const router = express.Router();
const {
  getAllBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  updateLogo,
  getMyBrand,
} = require("../controllers/brandController");
const { protect, restrictTo } = require("../middleware/auth");

router.get("/", getAllBrands);
router.get("/my/dashboard", protect, restrictTo("brand"), getMyBrand);
router.post("/", protect, restrictTo("brand"), createBrand);
router.get("/:id", getBrandById);
router.patch("/:id/logo", protect, restrictTo("brand"), updateLogo);
router.patch("/:id", protect, restrictTo("brand"), updateBrand);
router.delete("/:id", protect, restrictTo("brand"), deleteBrand);

module.exports = router;
