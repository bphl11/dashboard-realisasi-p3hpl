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

const MAX_REDIRECTS = 0;

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
          version: "2.2.0",
          upstream: safeUrl(UPSTREAM_URL),
          redirect_mode: "native-follow",
          max_redirects: null
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
        "RPD-P3HPL-Cloudflare-Proxy/2.1"
      );

      const incomingContentType =
        request.headers.get("Content-Type") ||
        "text/plain;charset=utf-8";

      baseHeaders.set("Content-Type", incomingContentType);

      // Gunakan native redirect handling dari fetch().
      // Google Apps Script ContentService melakukan redirect ke
      // script.googleusercontent.com. Fetch native mengikuti redirect
      // sesuai standar HTTP sehingga POST 302/303 menjadi GET dan
      // 307/308 mempertahankan method/body tanpa kita mengelola URL
      // redirect sementara secara manual.
      const upstreamRequest = new Request(UPSTREAM_URL, {
        method: "POST",
        headers: baseHeaders,
        body
      });

      const upstreamResponse = await fetch(upstreamRequest, {
        redirect: "follow"
      });
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
