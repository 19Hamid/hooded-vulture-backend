// api/chat.js
import Groq from "groq-sdk";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://beakspeak-chatbot.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, personality, sessionId } = req.body;
  if (!text) return res.status(400).json({ error: "No text provided" });

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are the Hooded Vulture assistant." },
        { role: "user", content: text },
      ],
    });

    res.status(200).json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Backend failed to respond" });
  }
}