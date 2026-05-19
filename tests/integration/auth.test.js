jest.mock("../../src/models/User");

const request = require("supertest");
const User = require("../../src/models/User");
const app = require("../../src/app");

const buildUser = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439011",
  name: "Jane Doe",
  email: "jane@example.com",
  role: "customer",
  avatar: null,
  isOnline: false,
  lastSeen: new Date().toISOString(),
  toJSON() {
    return { ...this, password: undefined };
  },
  comparePassword: jest.fn().mockResolvedValue(true),
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe("Integration: Auth API with Supertest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/auth/register registers a new user and returns token", async () => {
    const createdUser = buildUser();
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue(createdUser);

    const res = await request(app).post("/api/auth/register").send({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "securepass",
      role: "customer",
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(User.create).toHaveBeenCalledWith({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "securepass",
      role: "customer",
    });
  });

  test("POST /api/auth/register returns 409 when email already exists", async () => {
    User.findOne.mockResolvedValue(buildUser());

    const res = await request(app).post("/api/auth/register").send({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "securepass",
      role: "customer",
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe("Email already registered.");
  });

  test("POST /api/auth/login returns token with valid credentials", async () => {
    const user = buildUser();
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

    const res = await request(app).post("/api/auth/login").send({
      email: "jane@example.com",
      password: "securepass",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(user.comparePassword).toHaveBeenCalledWith("securepass");
  });

  test("POST /api/auth/login returns 401 on wrong password", async () => {
    const user = buildUser({ comparePassword: jest.fn().mockResolvedValue(false) });
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });

    const res = await request(app).post("/api/auth/login").send({
      email: "jane@example.com",
      password: "wrongpass",
    });

    expect(res.statusCode).toBe(401);
  });

  test("GET /api/auth/me returns profile with valid token", async () => {
    const user = buildUser();
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    User.findById.mockResolvedValue(user);

    const login = await request(app).post("/api/auth/login").send({
      email: "jane@example.com",
      password: "securepass",
    });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.data.token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.user.email).toBe("jane@example.com");
  });

  test("GET /api/auth/me returns 401 without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.statusCode).toBe(401);
  });
});
