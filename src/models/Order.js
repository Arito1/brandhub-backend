const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      default: null,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Order must belong to a user"],
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "Order must have at least one item",
      },
    },
    totalPrice: {
      type: Number,
      required: [true, "Total price is required"],
      min: [0, "Total price cannot be negative"],
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    deliveryAddress: {
      street: { type: String, required: [true, "Street is required"] },
      city: { type: String, required: [true, "City is required"] },
      country: { type: String, required: [true, "Country is required"] },
      postalCode: { type: String, required: [true, "Postal code is required"] },
      phone: { type: String, required: [true, "Phone is required"] },
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },
    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"],
      default: "",
    },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ "items.brand": 1, status: 1 });

module.exports = mongoose.model("Order", orderSchema);
