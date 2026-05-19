const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Brand name is required"],
      trim: true,
      unique: true,
      minlength: [2, "Brand name must be at least 2 characters"],
      maxlength: [100, "Brand name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Brand description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    logo: {
      type: String,
      default: null,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Brand must have an owner"],
      unique: true,
    },
    category: {
      type: String,
      required: [true, "Brand category is required"],
      enum: [
        "fashion",
        "electronics",
        "food",
        "beauty",
        "sports",
        "home",
        "toys",
        "books",
        "other",
      ],
    },
    website: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    totalSales: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

brandSchema.virtual("products", {
  ref: "Product",
  localField: "_id",
  foreignField: "brand",
});

module.exports = mongoose.model("Brand", brandSchema);
