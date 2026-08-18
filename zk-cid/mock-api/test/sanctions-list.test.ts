import { describe, it, expect, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "../api/sanctions-list";

function mockReq(method: string): VercelRequest {
  return {
    method,
    headers: {},
    query: {},
    body: undefined,
    url: "/api/sanctions-list",
  } as unknown as VercelRequest;
}

function mockRes(): { _status: number; _headers: Record<string, string>; _body: unknown } {
  const res = {
    _status: 200,
    _headers: {} as Record<string, string>,
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
    setHeader(key: string, value: string) {
      res._headers[key] = value;
    },
  } as unknown as VercelResponse;
  return res;
}

describe("sanctions-list API", () => {
  it("returns 200 with the expected schema on GET", () => {
    const req = mockReq("GET");
    const res = mockRes();
    handler(req, res as unknown as VercelResponse);

    expect(res._status).toBe(200);
    const body = res._body as Record<string, unknown>;
    expect(body).toHaveProperty("sanctioned");
    expect(body).toHaveProperty("source");
    expect(body).toHaveProperty("updatedAt");
    expect(Array.isArray(body.sanctioned)).toBe(true);
  });

  it("sets Cache-Control: no-store on GET", () => {
    const req = mockReq("GET");
    const res = mockRes();
    handler(req, res as unknown as VercelResponse);

    expect(res._headers["Cache-Control"]).toBe("no-store");
  });

  it("returns 405 on POST", () => {
    const req = mockReq("POST");
    const res = mockRes();
    handler(req, res as unknown as VercelResponse);

    expect(res._status).toBe(405);
    expect(res._body).toEqual({ error: "Method not allowed" });
  });

  it("returns 405 on PUT", () => {
    const req = mockReq("PUT");
    const res = mockRes();
    handler(req, res as unknown as VercelResponse);

    expect(res._status).toBe(405);
  });

  it("returns 405 on DELETE", () => {
    const req = mockReq("DELETE");
    const res = mockRes();
    handler(req, res as unknown as VercelResponse);

    expect(res._status).toBe(405);
  });
});
