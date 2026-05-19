const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Product title is required"],
      trim: true,
      minlength: [2, "Title must be at least 2 characters"],
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          return arr.length <= 10;
        },
        message: "A product can have at most 10 images",
      },
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: [true, "Product must belong to a brand"],
    },
    stock: {
      type: Number,
      required: [true, "Stock quantity is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    category: {
      type: String,
      required: [true, "Product category is required"],
      trim: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

productSchema.index({ title: "text", description: "text", tags: "text" });

productSchema.pre("save", function (next) {
  if (this.isModified("stock")) {
    this.isAvailable = this.stock > 0;
  }
  next();
});

module.exports = mongoose.model("Product", productSchema);
