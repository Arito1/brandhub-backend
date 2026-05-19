const mongoose = require("mongoose");
const User = require("../../src/models/User");

describe("Unit: User model validation", () => {
  // We only test schema validation, not DB writes
  const buildUser = (overrides = {}) => {
    const base = {
      name: "Test User",
      email: "test@example.com",
      password: "password123",
      role: "customer",
    };
    return new User({ ...base, ...overrides });
  };

  test("valid user passes validation", async () => {
    const user = buildUser();
    await expect(user.validate()).resolves.toBeUndefined();
  });

  test("rejects missing name", async () => {
    const user = buildUser({ name: undefined });
    await expect(user.validate()).rejects.toThrow(/Name is required/);
  });

  test("rejects missing email", async () => {
    const user = buildUser({ email: undefined });
    await expect(user.validate()).rejects.toThrow(/Email is required/);
  });

  test("rejects invalid email format", async () => {
    const user = buildUser({ email: "not-an-email" });
    await expect(user.validate()).rejects.toThrow(/valid email/);
  });

  test("rejects password shorter than 6 characters", async () => {
    const user = buildUser({ password: "abc" });
    await expect(user.validate()).rejects.toThrow(/at least 6/);
  });

  test("rejects invalid role", async () => {
    const user = buildUser({ role: "admin" });
    await expect(user.validate()).rejects.toThrow();
  });

  test("defaults role to 'customer' when not provided", () => {
    const user = buildUser({ role: undefined });
    expect(user.role).toBe("customer");
  });
});
