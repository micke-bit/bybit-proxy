export const config = {
  runtime: "edge",
  regions: ["fra1"],
};

export default async function handler(request) {
  const PROXY_TOKEN = process.env.PROXY_TOKEN || "CHANGE_ME";
  const BYBIT_URLS = [
    "https://api.bybit.com",
    "https://api.bybitglobal.com",
    "https://api.bytick.com",
  ];

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("proxy_token");
  if (!token || token !== PROXY_TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  url.searchParams.delete("proxy_token");
  const bybitPath = url.searchParams.get("path") || "/";
  url.searchParams.delete("path");
  const remainingParams = url.searchParams.toString();
  const pathAndQuery = bybitPath + (remainingParams ? "?" + remainingParams : "");

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase().startsWith("x-bapi-")) {
      headers.set(key, value);
    }
  }
  headers.set("Content-Type", "application/json");

  let lastError = "";
  for (const baseUrl of BYBIT_URLS) {
    try {
      const bybitUrl = baseUrl + pathAndQuery;
      const resp = await fetch(bybitUrl, { method: request.method, headers });
      const body = await resp.text();
      if (resp.status === 403 && body.includes("<!DOCTYPE")) {
        lastError = baseUrl + " returned 403";
        continue;
      }
      return new Response(body, {
        status: resp.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "X-Proxy-Via": baseUrl,
        },
      });
    } catch (e) {
      lastError = baseUrl + ": " + e.message;
      continue;
    }
  }

  return new Response(
    JSON.stringify({ error: "All Bybit endpoints blocked", detail: lastError }),
    { status: 502, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
  );
}
