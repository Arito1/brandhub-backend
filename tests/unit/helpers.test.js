const { calculateTotal, sendSuccess, sendError } = require("../../src/utils/helpers");

describe("Unit: helpers utility functions", () => {
  describe("calculateTotal()", () => {
    test("calculates total for single item", () => {
      expect(calculateTotal([{ price: 100, quantity: 2 }])).toBe(200);
    });

    test("calculates total for multiple items", () => {
      const items = [
        { price: 50, quantity: 1 },
        { price: 25, quantity: 4 },
        { price: 10, quantity: 3 },
      ];
      expect(calculateTotal(items)).toBe(180);
    });

    test("returns 0 for empty array", () => {
      expect(calculateTotal([])).toBe(0);
    });
  });

  describe("sendSuccess()", () => {
    const mockRes = () => {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res;
    };

    test("sends 200 with success payload", () => {
      const res = mockRes();
      sendSuccess(res, 200, "OK", { foo: "bar" });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "OK",
        data: { foo: "bar" },
      });
    });

    test("sends 201 created", () => {
      const res = mockRes();
      sendSuccess(res, 201, "Created");
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("sendError()", () => {
    const mockRes = () => {
      const res = {};
      res.status = jest.fn().mockReturnValue(res);
      res.json = jest.fn().mockReturnValue(res);
      return res;
    };

    test("sends error response with correct shape", () => {
      const res = mockRes();
      sendError(res, 404, "Not found");
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Not found",
      });
    });
  });
});
