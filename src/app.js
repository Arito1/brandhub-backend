const express = require("express");
const cors = require("cors");
const { createRouteHandler } = require("uploadthing/express");
const { uploadRouter } = require("./config/uploadthing");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth");
const brandRoutes = require("./routes/brands");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const userRoutes = require("./routes/users");

const app = express();

const allowedOrigin = process.env.CLIENT_URL || "http://localhost:3000";

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "x-product-id"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "BrandHub API is running", env: process.env.NODE_ENV });
});

app.use(
  "/api/uploadthing",
  createRouteHandler({
    router: uploadRouter,
    config: { isDev: process.env.NODE_ENV !== "production" },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

app.use(errorHandler);

module.exports = app;
