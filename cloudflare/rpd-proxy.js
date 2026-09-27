/**
 * RPD P3HPL - Cloudflare Workers CORS Proxy
 *
 * Browser:
 *   https://bphl11.github.io
 *        ↓
 * Cloudflare Worker
 *        ↓
 * Google Apps Script Web App
 *
 * IMPORTANT:
 * - This is a FIXED proxy, not an open proxy.
 * - The upstream Apps Script URL is hard-coded.
 * - Only the RPD API origin is allowed from browsers.
 */

const UPSTREAM_URL =
  "https://script.google.com/macros/s/AKfycbxxncp8pn5sF5pGOzErDG2vmHiDWfR0R3_m9QXRUXxfb41R9MqbkLyRmMiE98CmIeth7Q/exec";

const ALLOWED_ORIGINS = new Set([
  "https://bphl11.github.io",
  "http://localhost",
  "http://127.0.0.1"
]);

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };

  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin)
    }
  });
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json(
        {
          ok: true,
          service: "RPD P3HPL Cloudflare Proxy",
          version: "1.0.0"
        },
        200,
        origin
      );
    }

    if (url.pathname !== "/rpd") {
      return json(
        { ok: false, message: "Endpoint tidak ditemukan." },
        404,
        origin
      );
    }

    if (request.method !== "POST") {
      return json(
        { ok: false, message: "Method tidak diizinkan. Gunakan POST." },
        405,
        origin
      );
    }

    try {
      const body = await request.text();

      const upstreamHeaders = new Headers();
      upstreamHeaders.set(
        "Content-Type",
        request.headers.get("Content-Type") || "text/plain;charset=utf-8"
      );
      upstreamHeaders.set("Accept", "application/json, text/plain, */*");
      upstreamHeaders.set(
        "User-Agent",
        "RPD-P3HPL-Cloudflare-Proxy/1.0"
      );

      // Google Apps Script ContentService dapat melakukan redirect
      // dari script.google.com ke script.googleusercontent.com.
      // Jangan gunakan redirect:"follow" tanpa batas karena pada kondisi
      // tertentu Cloudflare dapat menerima loop redirect dari Apps Script.
      let upstreamResponse = null;
      let currentUrl = UPSTREAM_URL;
      let currentMethod = "POST";
      let currentBody = body;

      for (let redirectCount = 0; redirectCount < 6; redirectCount++) {
        const requestHeaders = new Headers(upstreamHeaders);

        if (currentMethod === "GET") {
          requestHeaders.delete("Content-Type");
        }

        const upstreamRequest = new Request(currentUrl, {
          method: currentMethod,
          headers: requestHeaders,
          body: currentMethod === "GET" || currentMethod === "HEAD"
            ? undefined
            : currentBody
        });

        upstreamResponse = await fetch(upstreamRequest, {
          redirect: "manual"
        });

        const location = upstreamResponse.headers.get("Location");

        if (!location || ![301, 302, 303, 307, 308].includes(upstreamResponse.status)) {
          break;
        }

        if (redirectCount === 5) {
          return json(
            {
              ok: false,
              message: "Google Apps Script terlalu banyak redirect.",
              detail: "Redirect melebihi batas aman (5).",
              last_status: upstreamResponse.status
            },
            508,
            origin
          );
        }

        currentUrl = new URL(location, currentUrl).toString();

        // Google ContentService biasanya memakai 302/303 untuk
        // mengalihkan POST ke URL content hasil eksekusi. Ikuti sebagai GET.
        if ([301, 302, 303].includes(upstreamResponse.status)) {
          currentMethod = "GET";
          currentBody = null;
        }
      }

      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders
      });
    } catch (error) {
      return json(
        {
          ok: false,
          message: "Proxy RPD gagal menghubungi Apps Script.",
          detail: String(error?.message || error)
        },
        502,
        origin
      );
    }
  }
};
