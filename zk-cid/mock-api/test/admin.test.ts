import { beforeEach, describe, expect, it } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "../api/admin";
import { SNARK_SCALAR_FIELD, validateCommitment } from "../lib/validate";

function mockReq(method: string, opts: { token?: string; body?: unknown } = {}): VercelRequest {
  return {
    method,
    headers: opts.token
      ? { "x-admin-token": opts.token, "x-forwarded-for": "203.0.113.7" }
      : { "x-forwarded-for": "203.0.113.7" },
    query: {},
    body: opts.body,
    url: "/api/admin",
  } as unknown as VercelRequest;
}

function mockRes() {
  const res = {
    _status: 200,
    _body: undefined as unknown,
    status(code: number) {
      res._status = code;
      return {
        json(body: unknown) {
          res._body = body;
          return res;
        },
      };
    },
    setHeader() {},
  } as unknown as VercelResponse;
  return res;
}

const call = (req: VercelRequest) => {
  const res = mockRes();
  handler(req, res as unknown as VercelResponse);
  return res as unknown as { _status: number; _body: unknown };
};

describe("mock-api commitment validation", () => {
  it("accepts decimal field elements below the BN254 scalar field", () => {
    expect(validateCommitment("12345678901234567890")).toEqual({
      ok: true,
      value: "12345678901234567890",
    });
    expect(validateCommitment((SNARK_SCALAR_FIELD - 1n).toString()).ok).toBe(true);
  });

  it("rejects zero, negatives, non-decimal values, oversized values and the field modulus", () => {
    for (const invalid of ["0", "-1", "abc", "1.5", "0x10", "9".repeat(79), SNARK_SCALAR_FIELD.toString()]) {
      expect(validateCommitment(invalid).ok, `expected ${invalid} to be rejected`).toBe(false);
    }
  });
});

describe("admin API", () => {
  beforeEach(() => {
    process.env.ADMIN_TOKEN = "dev-token";
    delete (globalThis as unknown as { __sanctions?: unknown }).__sanctions;
  });

  it("returns 405 for non-POST methods", () => {
    const res = call(mockReq("GET"));
    expect(res._status).toBe(405);
  });

  it("returns 401 when the admin token is wrong", () => {
    const res = call(mockReq("POST", { token: "wrong", body: { action: "status" } }));
    expect(res._status).toBe(401);
  });

  it("returns 400 for a malformed commitment instead of poisoning the list", () => {
    const res = call(
      mockReq("POST", { token: "dev-token", body: { action: "add", commitment: "not-a-number" } }),
    );
    expect(res._status).toBe(400);
    expect((res._body as { error: string }).error).toContain("decimal");
  });

  it("rejects commitments outside the BN254 scalar field", () => {
    const res = call(
      mockReq("POST", {
        token: "dev-token",
        body: { action: "add", commitment: SNARK_SCALAR_FIELD.toString() },
      }),
    );
    expect(res._status).toBe(400);
  });

  it("adds a valid commitment and returns the public view", () => {
    const commitment = "123456789012345678901234567890123456789";
    const res = call(mockReq("POST", { token: "dev-token", body: { action: "add", commitment } }));

    expect(res._status).toBe(200);
    const data = (res._body as { data: { sanctioned: string[] } }).data;
    expect(data.sanctioned).toContain(commitment);
  });

  it("rejects unknown actions", () => {
    const res = call(mockReq("POST", { token: "dev-token", body: { action: "nuke" } }));
    expect(res._status).toBe(400);
  });
});
