const Brand = require("../models/Brand");
const Product = require("../models/Product");
const { sendSuccess, sendError } = require("../utils/helpers");
const { broadcastAll, attachBrandToUserSockets } = require("../websocket/wsManager");

/** GET /api/brands */
const getAllBrands = async (req, res, next) => {
  try {
    const { category, search, page = 1, limit = 12 } = req.query;
    const filter = { isActive: true };

    if (category) filter.category = category;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Brand.countDocuments(filter);
    const brands = await Brand.find(filter)
      .populate("owner", "name email avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return sendSuccess(res, 200, "Brands retrieved.", {
      brands,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/brands/my/dashboard */
const getMyBrand = async (req, res, next) => {
  try {
    const brand = await Brand.findOne({ owner: req.user._id }).populate("owner", "name email avatar");
    if (!brand) return sendError(res, 404, "You don't have a brand yet.");

    return sendSuccess(res, 200, "Your brand retrieved.", { brand });
  } catch (error) {
    next(error);
  }
};

/** GET /api/brands/:id */
const getBrandById = async (req, res, next) => {
  try {
    const brand = await Brand.findById(req.params.id).populate("owner", "name email avatar");
    if (!brand || !brand.isActive) return sendError(res, 404, "Brand not found.");

    const products = await Product.find({ brand: brand._id, isAvailable: true })
      .sort({ createdAt: -1 })
      .limit(20);

    return sendSuccess(res, 200, "Brand retrieved.", { brand, products });
  } catch (error) {
    next(error);
  }
};

/** POST /api/brands */
const createBrand = async (req, res, next) => {
  try {
    const existing = await Brand.findOne({ owner: req.user._id });
    if (existing) return sendError(res, 409, "You already have a brand.");

    const { name, description, category, website } = req.body;
    const brand = await Brand.create({ name, description, category, website, owner: req.user._id });

    await brand.populate("owner", "name email avatar");
    attachBrandToUserSockets(req.user._id, brand._id);
    broadcastAll({ type: "BRAND_CREATED", payload: { brand } });

    return sendSuccess(res, 201, "Brand created.", { brand });
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/brands/:id */
const updateBrand = async (req, res, next) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) return sendError(res, 404, "Brand not found.");

    if (brand.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, "Not authorized to update this brand.");
    }

    const allowed = ["name", "description", "category", "website", "isActive", "logo"];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) brand[field] = req.body[field];
    });

    await brand.save();
    await brand.populate("owner", "name email avatar");

    broadcastAll({ type: "BRAND_UPDATED", payload: { brand } });

    return sendSuccess(res, 200, "Brand updated.", { brand });
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/brands/:id */
const deleteBrand = async (req, res, next) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) return sendError(res, 404, "Brand not found.");

    if (brand.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, "Not authorized to delete this brand.");
    }

    brand.isActive = false;
    await brand.save();
    await Product.updateMany({ brand: brand._id }, { isAvailable: false });

    broadcastAll({ type: "BRAND_DELETED", payload: { brandId: brand._id } });
    broadcastAll({ type: "PRODUCTS_REFRESH", payload: { brandId: brand._id } });

    return sendSuccess(res, 200, "Brand deactivated.");
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/brands/:id/logo */
const updateLogo = async (req, res, next) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) return sendError(res, 404, "Brand not found.");

    if (brand.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, "Not authorized.");
    }

    const { logoUrl } = req.body;
    if (!logoUrl) return sendError(res, 400, "logoUrl is required.");

    brand.logo = logoUrl;
    await brand.save();
    await brand.populate("owner", "name email avatar");

    broadcastAll({ type: "BRAND_LOGO_UPDATED", payload: { brand } });
    broadcastAll({ type: "BRAND_UPDATED", payload: { brand } });

    return sendSuccess(res, 200, "Logo updated.", { brand });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
  updateLogo,
  getMyBrand,
};
