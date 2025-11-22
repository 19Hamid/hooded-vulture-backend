export const config = { runtime: "edge" };

export default async function middleware(req) {
  // Allow requests from your frontend domain
  const allowedOrigin = "https://hooded-vulture-frontend.vercel.app";

  const headers = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Handle OPTIONS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  // Continue to the actual endpoint
  const response = await fetch(req.url, { headers });
  return response;
}
