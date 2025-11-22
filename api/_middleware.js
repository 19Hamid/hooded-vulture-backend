export const config = { runtime: "edge" };

export default function middleware(req) {
  const response = new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "https://hooded-vulture-frontend-hrepg43o5-hamids-projects-6c07675c.vercel.app",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });

  if (req.method === "OPTIONS") return response;
  return response;
}
