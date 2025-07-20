const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🧠 Generate Questions API
app.post("/api/generate", async (req, res) => {
  const { resumeText } = req.body;

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "API Key not found in .env" });
  }

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openchat/openchat-3.5-0106",
        messages: [
          {
            role: "system",
            content:
              "Generate 5 unique and specific interview questions based on the resume text below. Return each question in a new line only.",
          },
          {
            role: "user",
            content: resumeText,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "AI Interview Tool",
        },
      }
    );

    res.json({ questions: response.data.choices[0].message.content });
  } catch (error) {
    console.error("❌ Error generating questions:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate interview questions." });
  }
});

// 📝 Score + Feedback API
// 📝 Score + Feedback API
app.post("/api/score", async (req, res) => {
  const { questions, answers } = req.body;

  if (!Array.isArray(questions) || !Array.isArray(answers) || questions.length !== answers.length) {
    return res.status(400).json({ error: "Questions and answers must be arrays of equal length." });
  }

  const scores = [];
  const feedback = [];

  try {
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const answer = answers[i];

      let score = 0;
      let fb = "⚠️ Default feedback: Please provide a detailed and structured answer.";

      try {
        const aiResponse = await axios.post(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            model: "openchat/openchat-3.5-0106",
            messages: [
              {
                role: "system",
                content: `Return ONLY valid JSON:\n{"score": 8, "feedback": "Your answer was strong and specific."}`,
              },
              {
                role: "user",
                content: `Question: ${question}\nAnswer: ${answer}`,
              },
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "http://localhost:3000",
              "X-Title": "AI Interview Tool",
            },
          }
        );

        const reply = aiResponse.data.choices[0].message.content.trim();

        try {
          const parsed = JSON.parse(reply);
          if (typeof parsed.score === "number") score = parsed.score;
          if (typeof parsed.feedback === "string") fb = parsed.feedback;
        } catch (e) {
          const scoreMatch = reply.match(/score\s*[:\-]?\s*(\d{1,2})/i);
          const feedbackMatch = reply.match(/feedback\s*[:\-]?\s*(.+)/i);

          score = scoreMatch ? parseInt(scoreMatch[1]) : 5;
          fb = feedbackMatch ? feedbackMatch[1].trim() : fb;
        }

      } catch (error) {
        console.warn(`❌ AI call failed, using default score for Q${i + 1}`);
        // score and fb remain defaults
      }

      scores.push(score);
      feedback.push(fb);
    }

    res.json({ scores, feedback });
  } catch (error) {
    console.error("❌ Final error scoring:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to evaluate answers." });
  }
});

// ✅ Start Server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
