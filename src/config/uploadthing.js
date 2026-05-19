const { createUploadthing } = require("uploadthing/express");
const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const Brand = require("../models/Brand");
const Product = require("../models/Product");
const { broadcastAll, broadcastToUser } = require("../websocket/wsManager");

const f = createUploadthing();

const getHeader = (req, name) => {
  if (!req?.headers) return undefined;
  return req.headers[name] || req.headers[name.toLowerCase()];
};

const getBearerToken = (req) => {
  const authHeader = getHeader(req, "authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.split(" ")[1];
};

const authenticate = async ({ req }) => {
  const token = getBearerToken(req);
  if (!token) throw new Error("Unauthorized");

  const decoded = verifyToken(token);
  const user = await User.findById(decoded.id);
  if (!user) throw new Error("User not found");

  return { userId: user._id.toString(), role: user.role };
};

const uploadRouter = {
  userAvatar: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(authenticate)
    .onUploadComplete(async ({ metadata, file }) => {
      const user = await User.findByIdAndUpdate(
        metadata.userId,
        { avatar: file.url },
        { new: true, runValidators: true }
      );

      broadcastToUser(metadata.userId, {
        type: "USER_AVATAR_UPDATED",
        payload: { user },
      });

      return { uploadedBy: metadata.userId, url: file.url, userId: metadata.userId };
    }),

  brandLogo: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const meta = await authenticate({ req });
      if (meta.role !== "brand") throw new Error("Only brand accounts can upload a logo.");

      const brand = await Brand.findOne({ owner: meta.userId });
      if (!brand) throw new Error("Create a brand profile first.");

      return { userId: meta.userId, brandId: brand._id.toString() };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const brand = await Brand.findByIdAndUpdate(
        metadata.brandId,
        { logo: file.url },
        { new: true, runValidators: true }
      ).populate("owner", "name email avatar");

      broadcastAll({ type: "BRAND_LOGO_UPDATED", payload: { brand } });
      broadcastAll({ type: "BRAND_UPDATED", payload: { brand } });

      return { brandId: metadata.brandId, url: file.url };
    }),

  productImages: f({ image: { maxFileSize: "8MB", maxFileCount: 5 } })
    .middleware(async ({ req, input }) => {
      const meta = await authenticate({ req });
      if (meta.role !== "brand") throw new Error("Only brand accounts can upload product images.");

      const productId = input?.productId || getHeader(req, "x-product-id");
      if (!productId) throw new Error("productId is required for product image uploads.");

      const product = await Product.findById(productId).populate("brand");
      if (!product) throw new Error("Product not found.");
      if (product.brand.owner.toString() !== meta.userId) {
        throw new Error("Not authorized to upload images for this product.");
      }

      return { userId: meta.userId, productId: product._id.toString() };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const product = await Product.findById(metadata.productId).populate("brand", "name logo category owner");
      if (!product) throw new Error("Product not found.");

      product.images = [...product.images, file.url].slice(0, 10);
      await product.save();

      broadcastAll({ type: "PRODUCT_UPDATED", payload: { product } });
      broadcastAll({ type: "PRODUCTS_REFRESH", payload: { productId: product._id } });

      return { productId: metadata.productId, url: file.url };
    }),
};

module.exports = { uploadRouter };
