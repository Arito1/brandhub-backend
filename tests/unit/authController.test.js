

jest.mock("../../src/models/User");
jest.mock("../../src/utils/jwt");

const User = require("../../src/models/User");
const { generateToken } = require("../../src/utils/jwt");
const { register, login } = require("../../src/controllers/authController");

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("Unit: authController (mocked)", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("register()", () => {
    test("returns 409 when email already exists", async () => {
      User.findOne.mockResolvedValue({ email: "taken@example.com" });
      const req = { body: { name: "Bob", email: "taken@example.com", password: "pass123" } };
      const res = mockRes();
      await register(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(409);
    });

    test("creates user and returns 201 with token", async () => {
      User.findOne.mockResolvedValue(null);
      const fakeUser = { _id: "uid1", name: "Alice", email: "alice@example.com", role: "customer" };
      User.create.mockResolvedValue(fakeUser);
      generateToken.mockReturnValue("fake.jwt.token");

      const req = { body: { name: "Alice", email: "alice@example.com", password: "pass123" } };
      const res = mockRes();
      await register(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(201);
      expect(generateToken).toHaveBeenCalledWith("uid1");
    });
  });

  describe("login()", () => {
    test("returns 400 when email or password missing", async () => {
      const req = { body: { email: "user@example.com" } }; // no password
      const res = mockRes();
      await login(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test("returns 401 for wrong credentials", async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null), // no user found
      });
      const req = { body: { email: "wrong@example.com", password: "wrongpass" } };
      const res = mockRes();
      await login(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
