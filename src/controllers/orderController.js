const Order = require("../models/Order");
const Product = require("../models/Product");
const Brand = require("../models/Brand");
const { sendSuccess, sendError, calculateTotal } = require("../utils/helpers");
const { broadcastToUser, broadcastToBrand, broadcastAll } = require("../websocket/wsManager");

/** POST /api/orders */
const createOrder = async (req, res, next) => {
  try {
    const { items, deliveryAddress, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, 400, "Order must contain at least one item.");
    }

    if (!deliveryAddress) return sendError(res, 400, "Delivery address is required.");

    const enrichedItems = [];
    const productsToUpdate = [];
    let brandId = null;

    for (const item of items) {
      if (!item.product) return sendError(res, 400, "Every item must include product id.");
      if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1) {
        return sendError(res, 400, "Quantity must be a positive integer.");
      }

      const quantity = Number(item.quantity);
      const product = await Product.findById(item.product).populate("brand");
      if (!product || !product.isAvailable || !product.brand?.isActive) {
        return sendError(res, 404, `Product ${item.product} is not available.`);
      }

      const currentBrandId = product.brand._id.toString();
      if (!brandId) brandId = currentBrandId;
      if (brandId !== currentBrandId) {
        return sendError(res, 400, "One order can contain products from one brand only. Create separate orders for different brands.");
      }

      if (product.stock < quantity) {
        return sendError(res, 400, `Insufficient stock for "${product.title}". Available: ${product.stock}.`);
      }

      enrichedItems.push({
        product: product._id,
        brand: product.brand._id,
        title: product.title,
        image: product.images[0] || null,
        price: product.price,
        quantity,
      });

      productsToUpdate.push({ product, quantity });
    }

    for (const { product, quantity } of productsToUpdate) {
      product.stock -= quantity;
      product.isAvailable = product.stock > 0;
      await product.save();
    }

    const totalPrice = calculateTotal(enrichedItems);
    const order = await Order.create({
      user: req.user._id,
      items: enrichedItems,
      totalPrice,
      deliveryAddress,
      notes: notes || "",
    });

    await order.populate("user", "name email avatar");

    broadcastToBrand(brandId, {
      type: "NEW_ORDER",
      payload: { order, orderId: order._id, totalPrice, customerName: req.user.name },
    });
    broadcastToBrand(brandId, { type: "ORDER_CREATED", payload: { order } });
    broadcastToUser(req.user._id, { type: "ORDER_CREATED", payload: { order } });
    broadcastAll({ type: "PRODUCTS_REFRESH", payload: { reason: "order_created" } });

    return sendSuccess(res, 201, "Order placed.", { order });
  } catch (error) {
    next(error);
  }
};

/** GET /api/orders/my */
const getMyOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const total = await Order.countDocuments({ user: req.user._id });
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return sendSuccess(res, 200, "Orders retrieved.", {
      orders,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/orders/:id */
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate("user", "name email avatar");
    if (!order) return sendError(res, 404, "Order not found.");

    const isOwner = order.user._id.toString() === req.user._id.toString();
    let isBrandOwner = false;

    if (req.user.role === "brand") {
      const brand = await Brand.findOne({ owner: req.user._id });
      if (brand) {
        isBrandOwner = order.items.some((item) => item.brand.toString() === brand._id.toString());
      }
    }

    if (!isOwner && !isBrandOwner) return sendError(res, 403, "Not authorized to view this order.");

    return sendSuccess(res, 200, "Order retrieved.", { order });
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/orders/:id/status */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ["confirmed", "shipped", "delivered", "cancelled"];

    if (!validStatuses.includes(status)) {
      return sendError(res, 400, `Invalid status. Allowed: ${validStatuses.join(", ")}.`);
    }

    const order = await Order.findById(req.params.id).populate("user", "name email avatar");
    if (!order) return sendError(res, 404, "Order not found.");

    const brand = await Brand.findOne({ owner: req.user._id });
    if (!brand) return sendError(res, 403, "No brand found for your account.");

    const belongsToBrand = order.items.some((item) => item.brand.toString() === brand._id.toString());
    if (!belongsToBrand) return sendError(res, 403, "Not authorized to update this order.");

    const previousStatus = order.status;
    order.status = status;

    if (status === "cancelled" && previousStatus !== "cancelled") {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity },
          $set: { isAvailable: true },
        });
      }
    }

    if (status === "delivered" && previousStatus !== "delivered") {
      brand.totalSales += order.totalPrice;
      await brand.save();
    }

    await order.save();

    const message = {
      type: "ORDER_STATUS_UPDATE",
      payload: { order, orderId: order._id, status, brandName: brand.name },
    };

    broadcastToUser(order.user._id.toString(), message);
    broadcastToBrand(brand._id.toString(), message);
    broadcastAll({ type: "PRODUCTS_REFRESH", payload: { reason: "order_status_updated" } });

    return sendSuccess(res, 200, "Order status updated.", { order });
  } catch (error) {
    next(error);
  }
};

/** GET /api/orders/brand */
const getBrandOrders = async (req, res, next) => {
  try {
    const brand = await Brand.findOne({ owner: req.user._id });
    if (!brand) return sendError(res, 404, "No brand found.");

    const { status, page = 1, limit = 20 } = req.query;
    const filter = { "items.brand": brand._id };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .populate("user", "name email avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return sendSuccess(res, 200, "Brand orders retrieved.", {
      orders,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createOrder, getMyOrders, getOrderById, updateOrderStatus, getBrandOrders };
