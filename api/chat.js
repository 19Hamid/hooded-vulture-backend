import Groq from "groq-sdk";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, personality, sessionId } = req.body;

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "You are the Hooded Vulture assistant." },
        { role: "user", content: text }
      ]
    });

    res.status(200).json({ reply: response.choices[0].message.content });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}