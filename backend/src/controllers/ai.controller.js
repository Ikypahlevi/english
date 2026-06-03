const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.chat = async (req, res) => {
  const { messages, selectedTopic } = req.body;
  if (!messages || messages.length === 0) {
    return res.status(400).json({ success: false, message: "Thiếu dữ liệu tin nhắn." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY.");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const chat = model.startChat({
      history: messages.slice(0, -1).map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      })),
      systemInstruction: {
        role: "system",
        parts: [{ text: `You are a friendly, encouraging English tutor. Practice conversation with the user using the vocabulary from the topic: "${selectedTopic}". Keep responses short (1-3 sentences) and conversational.` }]
      }
    });

    const userMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage([{ text: userMessage }]);
    const responseText = result.response.text();
    
    res.json({ success: true, text: responseText });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ success: false, message: "Lỗi kết nối AI: " + error.message });
  }
};

exports.transcribe = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "Không tìm thấy file âm thanh." });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY.");

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const prompt = `Please transcribe the spoken English in this audio file. Format your response sentence-by-sentence (or dialogue-by-dialogue). 
For each transcribed English sentence:
1. Write the English sentence. If this is a test/quiz audio, try to identify the correct answer or key phrases and format them with an underline (using markdown HTML like <u>underlined text</u> or **bold**).
2. Immediately below it, provide the Vietnamese translation for that specific sentence.

Example Format:
**English:** She is <u>holding a pen</u>.
**Dịch:** Cô ấy đang cầm một cây bút.`;

    const audioPart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype
      }
    };

    let result;
    let retries = 3;
    let delay = 2000;
    
    for (let i = 0; i < retries; i++) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        result = await model.generateContent([prompt, audioPart]);
        break; 
      } catch (error) {
        if (i === retries - 1) throw error; 
        if (error.message && error.message.includes("503")) {
          console.warn(`[Gemini API 503] Server overloaded. Retrying ${i + 1}/${retries} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; 
        } else {
          throw error; 
        }
      }
    }

    const responseText = result.response.text();
    res.json({ success: true, text: responseText });
  } catch (error) {
    console.error("Transcription Error:", error);
    let errorMsg = error.message;
    if (errorMsg.includes("503")) {
      errorMsg = "Hệ thống AI đang quá tải (Google Server 503). Vui lòng thử lại sau ít phút.";
    }
    res.status(500).json({ success: false, message: "Lỗi nhận diện âm thanh: " + errorMsg });
  }
};

exports.checkAnswer = async (req, res) => {
  const { word, correctMeaning, userAnswer } = req.body;
  if (!word || !correctMeaning || !userAnswer) return res.status(400).json({ success: false, message: "Thiếu dữ liệu" });

  try {
    const apiKey = process.env.GEMINI_API_KEY || ""; 
    const prompt = `Bạn là giám khảo máy móc chấm điểm từ vựng tiếng Anh.
Từ gốc: "${word}"
Nghĩa chuẩn: "${correctMeaning}"
Câu trả lời của người dùng: "${userAnswer}"

Luật chấm điểm:
1. Chỉ chấm điểm dựa trên ngữ nghĩa (chấp nhận từ đồng nghĩa, bao hàm ý nghĩa, bỏ qua hoa/thường, dấu câu).
2. TUYỆT ĐỐI KHÔNG giải thích thêm.
3. Bắt buộc CHỈ trả về duy nhất chuỗi JSON chuẩn: {"isCorrect": boolean, "reason": "string ngắn giải thích lý do"}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      })
    });
    
    if (!response.ok) throw new Error(`API AI Error - Status: ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI trả về kết quả rỗng");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Không giải mã được JSON");
    const result = JSON.parse(jsonMatch[0]);
    res.json({ success: true, data: result });
  } catch (error) {
    const normalizedUser = String(userAnswer).trim().toLowerCase();
    const normalizedCorrect = String(correctMeaning).trim().toLowerCase();
    const fallbackCorrect = normalizedCorrect.includes(normalizedUser) && normalizedUser.length >= 3;
    res.json({ success: true, data: { isCorrect: fallbackCorrect, reason: fallbackCorrect ? "Đúng (AI Fallback)" : "Sai (AI Fallback)" } });
  }
};
