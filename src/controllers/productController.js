const Product = require("../models/Product");
const Brand = require("../models/Brand");
const { sendSuccess, sendError } = require("../utils/helpers");
const { broadcastAll, broadcastToBrand } = require("../websocket/wsManager");

const populateProduct = (query) => query.populate("brand", "name logo category owner");

/** GET /api/products */
const getAllProducts = async (req, res, next) => {
  try {
    const {
      search,
      brand,
      category,
      minPrice,
      maxPrice,
      page = 1,
      limit = 16,
      sort = "createdAt",
      order = "desc",
    } = req.query;

    const filter = { isAvailable: true };

    if (search) filter.$text = { $search: search };
    if (brand) filter.brand = brand;
    if (category) filter.category = { $regex: category, $options: "i" };
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const safeSort = ["createdAt", "price", "title", "stock"].includes(sort) ? sort : "createdAt";
    const sortObj = { [safeSort]: order === "asc" ? 1 : -1 };
    const skip = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);

    const products = await Product.find(filter)
      .populate("brand", "name logo category")
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit));

    return sendSuccess(res, 200, "Products retrieved.", {
      products,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/products/my/products */
const getMyProducts = async (req, res, next) => {
  try {
    const brand = await Brand.findOne({ owner: req.user._id });
    if (!brand) return sendError(res, 404, "No brand found.");

    const products = await Product.find({ brand: brand._id }).sort({ createdAt: -1 });
    return sendSuccess(res, 200, "Your products retrieved.", { products });
  } catch (error) {
    next(error);
  }
};

/** GET /api/products/brand/:brandId */
const getProductsByBrand = async (req, res, next) => {
  try {
    const { page = 1, limit = 16 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = { brand: req.params.brandId, isAvailable: true };

    const brand = await Brand.findById(req.params.brandId);
    if (!brand || !brand.isActive) return sendError(res, 404, "Brand not found.");

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));

    return sendSuccess(res, 200, "Products retrieved.", {
      products,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/products/:id */
const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate("brand", "name logo description category owner isActive");
    if (!product || !product.brand?.isActive) return sendError(res, 404, "Product not found.");

    return sendSuccess(res, 200, "Product retrieved.", { product });
  } catch (error) {
    next(error);
  }
};

/** POST /api/products */
const createProduct = async (req, res, next) => {
  try {
    const brand = await Brand.findOne({ owner: req.user._id, isActive: true });
    if (!brand) return sendError(res, 403, "Create an active brand profile first.");

    const { title, description, price, stock, category, tags, images } = req.body;
    const product = await Product.create({
      title,
      description,
      price,
      stock,
      category,
      tags: Array.isArray(tags) ? tags : [],
      brand: brand._id,
      images: Array.isArray(images) ? images.slice(0, 10) : [],
    });

    await product.populate("brand", "name logo category owner");

    broadcastAll({ type: "PRODUCT_CREATED", payload: { product } });
    broadcastAll({ type: "PRODUCTS_REFRESH", payload: { productId: product._id } });
    broadcastToBrand(brand._id, { type: "PRODUCT_CREATED_FOR_BRAND", payload: { product } });

    return sendSuccess(res, 201, "Product created.", { product });
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/products/:id */
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate("brand");
    if (!product) return sendError(res, 404, "Product not found.");

    if (product.brand.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, "Not authorized to update this product.");
    }

    const allowed = ["title", "description", "price", "stock", "category", "tags", "images", "isAvailable"];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) product[field] = req.body[field];
    });

    if (Number(product.stock) <= 0) product.isAvailable = false;
    await product.save();
    await product.populate("brand", "name logo category owner");

    broadcastAll({ type: "PRODUCT_UPDATED", payload: { product } });
    broadcastAll({ type: "PRODUCTS_REFRESH", payload: { productId: product._id } });
    broadcastToBrand(product.brand._id, { type: "PRODUCT_UPDATED_FOR_BRAND", payload: { product } });

    return sendSuccess(res, 200, "Product updated.", { product });
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/products/:id */
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate("brand");
    if (!product) return sendError(res, 404, "Product not found.");

    if (product.brand.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, "Not authorized to delete this product.");
    }

    product.isAvailable = false;
    product.stock = 0;
    await product.save();

    broadcastAll({ type: "PRODUCT_DELETED", payload: { productId: product._id } });
    broadcastAll({ type: "PRODUCTS_REFRESH", payload: { productId: product._id } });

    return sendSuccess(res, 200, "Product removed from marketplace.");
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/products/:id/images */
const addProductImages = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate("brand");
    if (!product) return sendError(res, 404, "Product not found.");

    if (product.brand.owner.toString() !== req.user._id.toString()) {
      return sendError(res, 403, "Not authorized.");
    }

    const { imageUrls } = req.body;
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return sendError(res, 400, "imageUrls array is required.");
    }

    product.images = [...product.images, ...imageUrls].slice(0, 10);
    await product.save();
    await product.populate("brand", "name logo category owner");

    broadcastAll({ type: "PRODUCT_UPDATED", payload: { product } });
    broadcastAll({ type: "PRODUCTS_REFRESH", payload: { productId: product._id } });

    return sendSuccess(res, 200, "Images added.", { product });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  addProductImages,
  getProductsByBrand,
  getMyProducts,
};
