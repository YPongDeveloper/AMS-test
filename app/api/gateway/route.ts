import { NextRequest, NextResponse } from "next/server";
import { decryptPayload, encryptPayload } from "@/lib/api/crypto";

// Private server-side backend URL (never exposed to client browser)
const BACKEND_URL = (
  process.env.BACKEND_API_URL ||
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080"
).replace(/\/+$/, "");

interface GatewayRequest {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    let gatewayReq: GatewayRequest;

    if (json && typeof json.payload === "string") {
      gatewayReq = decryptPayload<GatewayRequest>(json.payload);
    } else {
      gatewayReq = json as GatewayRequest;
    }

    if (!gatewayReq || !gatewayReq.path) {
      return NextResponse.json(
        { payload: encryptPayload({ status: 400, message: "Invalid gateway request", data: null }) },
        { status: 400 }
      );
    }

    const { path, method = "GET", headers = {}, body } = gatewayReq;

    // Sanitize path to prevent SSRF
    const safePath = path.startsWith("/") ? path : `/${path}`;
    const targetUrl = `${BACKEND_URL}${safePath}`;

    const outgoingHeaders: Record<string, string> = {
      ...headers,
      "X-Forwarded-Host": req.headers.get("host") || "",
      "X-Real-IP": req.ip || req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "",
    };

    let fetchBody: string | undefined;
    if (body !== undefined && method !== "GET" && method !== "HEAD") {
      fetchBody = typeof body === "string" ? body : JSON.stringify(body);
      if (!outgoingHeaders["Content-Type"]) {
        outgoingHeaders["Content-Type"] = "application/json";
      }
    }

    const backendRes = await fetch(targetUrl, {
      method,
      headers: outgoingHeaders,
      body: fetchBody,
      cache: "no-store",
    });

    const responseText = await backendRes.text();
    let responseData: unknown;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    // Encrypt response payload to keep it hidden from browser DevTools
    const encryptedPayload = encryptPayload(responseData);

    return NextResponse.json(
      { payload: encryptedPayload },
      {
        status: backendRes.status,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  } catch (err: any) {
    const errorPayload = encryptPayload({
      status: 502,
      message: err?.message || "Gateway connection error",
      data: null,
    });
    return NextResponse.json({ payload: errorPayload }, { status: 502 });
  }
}
