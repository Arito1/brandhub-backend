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

const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-product-id",
    "x-uploadthing-package",
    "x-uploadthing-version",
    "x-uploadthing-fe-package",
    "uploadthing-hook",
    "x-uploadthing-signature",
  ],
};

app.use(cors({
  origin: true,
  credentials: true,
}));

app.options("*", cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "BrandHub API is running",
    env: process.env.NODE_ENV,
  });
});

const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;

app.use(
  "/api/uploadthing",
  createRouteHandler({
    router: uploadRouter,
    config: {
      token: process.env.UPLOADTHING_TOKEN,
      isDev: process.env.NODE_ENV !== "production",
      callbackUrl: `${apiUrl}/api/uploadthing`,
    },
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found.`,
  });
});

app.use(errorHandler);

module.exports = app;