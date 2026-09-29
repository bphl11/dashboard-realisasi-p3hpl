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
 * - Fixed proxy, not an open proxy.
 * - Upstream Apps Script URL is hard-coded.
 * - Redirects are followed manually with loop detection.
 * - Only the RPD API origin is allowed from browsers.
 */

const UPSTREAM_URL =
  "https://script.google.com/macros/s/AKfycbxxncp8pn5sF5pGOzErDG2vmHiDWfR0R3_m9QXRUXxfb41R9MqbkLyRmMiE98CmIeth7Q/exec";

const ALLOWED_ORIGINS = new Set([
  "https://bphl11.github.io",
  "http://localhost",
  "http://127.0.0.1"
]);

const MAX_REDIRECTS = 5;

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
      "Cache-Control": "no-store",
      ...corsHeaders(origin)
    }
  });
}

function safeUrl(value) {
  try {
    const u = new URL(value);
    // Do not expose potentially long/temporary query strings in diagnostics.
    return u.origin + u.pathname;
  } catch {
    return String(value || "");
  }
}

function responseHeaders(upstreamResponse, origin) {
  const headers = {
    "Cache-Control": "no-store",
    ...corsHeaders(origin)
  };

  const contentType = upstreamResponse.headers.get("Content-Type");
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  return headers;
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
          version: "1.2.0",
          upstream: safeUrl(UPSTREAM_URL),
          redirect_detection: true
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

      const baseHeaders = new Headers();
      baseHeaders.set(
        "Accept",
        "application/json, text/plain, */*"
      );
      baseHeaders.set(
        "User-Agent",
        "RPD-P3HPL-Cloudflare-Proxy/1.1"
      );

      const incomingContentType =
        request.headers.get("Content-Type") ||
        "text/plain;charset=utf-8";

      baseHeaders.set("Content-Type", incomingContentType);

      let currentUrl = UPSTREAM_URL;
      let currentMethod = "POST";
      let currentBody = body;
      let upstreamResponse = null;

      const redirectChain = [];
      const visited = new Set();

      for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt++) {
        const normalizedCurrentUrl = safeUrl(currentUrl);

        if (visited.has(currentUrl)) {
          return json(
            {
              ok: false,
              message: "Redirect loop terdeteksi pada Google Apps Script.",
              detail: "URL tujuan redirect kembali ke URL yang sudah dikunjungi.",
              last_status: upstreamResponse?.status || null,
              last_url: normalizedCurrentUrl,
              redirect_chain: redirectChain
            },
            508,
            origin
          );
        }

        visited.add(currentUrl);

        const requestHeaders = new Headers(baseHeaders);

        if (currentMethod === "GET" || currentMethod === "HEAD") {
          requestHeaders.delete("Content-Type");
        }

        const upstreamRequest = new Request(currentUrl, {
          method: currentMethod,
          headers: requestHeaders,
          body:
            currentMethod === "GET" || currentMethod === "HEAD"
              ? undefined
              : currentBody
        });

        upstreamResponse = await fetch(upstreamRequest, {
          redirect: "manual"
        });

        const status = upstreamResponse.status;
        const location = upstreamResponse.headers.get("Location");

        if (![301, 302, 303, 307, 308].includes(status) || !location) {
          break;
        }

        if (attempt >= MAX_REDIRECTS) {
          return json(
            {
              ok: false,
              message: "Google Apps Script terlalu banyak redirect.",
              detail: `Redirect melebihi batas aman (${MAX_REDIRECTS}).`,
              last_status: status,
              last_url: normalizedCurrentUrl,
              redirect_to: safeUrl(new URL(location, currentUrl).toString()),
              redirect_chain: redirectChain
            },
            508,
            origin
          );
        }

        const nextUrl = new URL(location, currentUrl).toString();

        redirectChain.push({
          step: attempt + 1,
          status,
          from: normalizedCurrentUrl,
          to: safeUrl(nextUrl)
        });

        if (visited.has(nextUrl)) {
          return json(
            {
              ok: false,
              message: "Redirect loop terdeteksi pada Google Apps Script.",
              detail: "Google Apps Script mengarahkan kembali ke URL yang sudah dikunjungi.",
              last_status: status,
              last_url: normalizedCurrentUrl,
              redirect_to: safeUrl(nextUrl),
              redirect_chain: redirectChain
            },
            508,
            origin
          );
        }

        currentUrl = nextUrl;

        // Google Apps Script ContentService/Web App commonly returns
        // 302/303 from script.google.com to script.googleusercontent.com.
        // For these redirects, follow with GET.
        if ([301, 302, 303].includes(status)) {
          currentMethod = "GET";
          currentBody = undefined;
        }
        // 307/308 preserve method and body.
      }

      if (!upstreamResponse) {
        return json(
          {
            ok: false,
            message: "Tidak ada respons dari Google Apps Script."
          },
          502,
          origin
        );
      }

      // ========================================================
      // DIAGNOSTIK RESPONSE UPSTREAM
      // ========================================================
      // Jangan meneruskan HTML error mentah dari upstream.
      // Untuk 404 dan 5xx, kembalikan JSON diagnostik agar browser
      // dapat membedakan error upstream dari error route Worker.
      const upstreamStatus = upstreamResponse.status;

      const isUpstreamDiagnosticStatus =
        upstreamStatus === 404 ||
        [500, 501, 502, 503, 504].includes(upstreamStatus);

      if (isUpstreamDiagnosticStatus) {
        const upstreamContentType =
          upstreamResponse.headers.get("Content-Type") || "";

        let upstreamBodyPreview = "";

        try {
          const upstreamText = await upstreamResponse.text();

          // Simpan hanya potongan pendek untuk diagnosis.
          // Tidak meneruskan seluruh response upstream.
          upstreamBodyPreview = upstreamText
            .replace(/\\s+/g, " ")
            .trim()
            .slice(0, 800);
        } catch (readError) {
          upstreamBodyPreview =
            "Gagal membaca body response upstream: " +
            String(readError?.message || readError);
        }

        return json(
          {
            ok: false,
            source: "upstream",
            message:
              upstreamStatus === 404
                ? "Google Apps Script / upstream mengembalikan HTTP 404."
                : "Google Apps Script / upstream mengembalikan HTTP " +
                  upstreamStatus + ".",
            upstream_status: upstreamStatus,
            upstream_content_type: upstreamContentType,
            last_url: safeUrl(currentUrl),
            redirect_chain: redirectChain,
            upstream_body_preview: upstreamBodyPreview
          },
          upstreamStatus,
          origin
        );
      }

      return new Response(upstreamResponse.body, {
        status: upstreamStatus,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders(upstreamResponse, origin)
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
