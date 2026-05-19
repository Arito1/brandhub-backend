jest.mock("../../src/models/User");
jest.mock("../../src/models/Brand");
jest.mock("../../src/models/Product");

const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/User");
const Brand = require("../../src/models/Brand");
const Product = require("../../src/models/Product");

const userId = "507f1f77bcf86cd799439011";
const brandId = "507f1f77bcf86cd799439012";
const productId = "507f1f77bcf86cd799439013";

const brandUser = {
  _id: userId,
  name: "Brand Owner",
  email: "brand@example.com",
  role: "brand",
  comparePassword: jest.fn().mockResolvedValue(true),
  save: jest.fn().mockResolvedValue(true),
  toJSON() {
    return { _id: userId, name: this.name, email: this.email, role: this.role };
  },
};

const brand = {
  _id: brandId,
  name: "Test Brand Co",
  description: "A brand for testing purposes only",
  category: "electronics",
  logo: null,
  owner: userId,
  isActive: true,
  populate: jest.fn().mockResolvedValue(true),
};

const product = {
  _id: productId,
  title: "Wireless Headphones",
  description: "High-quality sound with noise cancellation",
  price: 199.99,
  stock: 50,
  category: "electronics",
  tags: ["audio", "wireless"],
  images: [],
  isAvailable: true,
  brand: { ...brand, owner: userId },
  save: jest.fn().mockResolvedValue(true),
  populate: jest.fn().mockResolvedValue(true),
};

const loginAndGetToken = async () => {
  User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(brandUser) });
  const res = await request(app).post("/api/auth/login").send({
    email: "brand@example.com",
    password: "securepass",
  });
  return res.body.data.token;
};

describe("Integration: Products API with Supertest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockResolvedValue(brandUser);
    Brand.findOne.mockResolvedValue(brand);
  });

  test("POST /api/products allows a brand user to create a product", async () => {
    Product.create.mockResolvedValue({ ...product, populate: jest.fn().mockResolvedValue(true) });
    const token = await loginAndGetToken();

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Wireless Headphones",
        description: "High-quality sound with noise cancellation",
        price: 199.99,
        stock: 50,
        category: "electronics",
        tags: ["audio", "wireless"],
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.product.title).toBe("Wireless Headphones");
  });

  test("GET /api/products lists products", async () => {
    Product.countDocuments.mockResolvedValue(1);
    Product.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([product]),
          }),
        }),
      }),
    });

    const res = await request(app).get("/api/products");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data.products)).toBe(true);
  });

  test("PATCH /api/products/:id allows the owner brand to update a product", async () => {
    Product.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue({ ...product }) });
    const token = await loginAndGetToken();

    const res = await request(app)
      .patch(`/api/products/${productId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ price: 149.99 });

    expect(res.statusCode).toBe(200);
  });

  test("POST /api/products rejects unauthenticated users", async () => {
    const res = await request(app).post("/api/products").send({
      title: "Hack Product",
      description: "Should not work",
      price: 1,
      stock: 1,
      category: "other",
    });

    expect(res.statusCode).toBe(401);
  });
});
