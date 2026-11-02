export async function onRequest(context: { request: Request; env?: Record<string, string> }): Promise<Response> {
  const url = new URL(context.request.url);
  const backendBase =
    context.env?.BACKEND_URL ||
    (url.hostname === "localhost" || url.hostname === "127.0.0.1"
      ? "http://127.0.0.1:5000"
      : "https://knotty-backend.vercel.app");
  const targetUrl = `${backendBase}${url.pathname}${url.search}`;

  const targetParsed = new URL(backendBase);
  const reqHeaders = new Headers(context.request.headers);
  reqHeaders.set("Host", targetParsed.host);

  const newRequest = new Request(targetUrl, {
    method: context.request.method,
    headers: reqHeaders,
    body: ["GET", "HEAD"].includes(context.request.method) ? undefined : context.request.body,
    redirect: "follow",
    duplex: "half",
  } as RequestInit & { duplex?: string });

  const response = await fetch(newRequest);
  const resHeaders = new Headers(response.headers);
  resHeaders.set("Access-Control-Allow-Origin", "*");
  resHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  resHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: resHeaders,
  });
}
