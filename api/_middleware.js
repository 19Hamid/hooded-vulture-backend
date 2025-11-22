// api/_middleware.js
export const config = { runtime: "edge" };

export default function middleware(req) {
  const response = new Response(null, {
    headers: {
      // Replace with your actual deployed frontend
      "Access-Control-Allow-Origin": "https://beakspeak-chatbot.vercel.app",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });

  // Respond immediately to OPTIONS preflight requests
  if (req.method === "OPTIONS") return response;

  return response;
}
