const SYSTEM_PROMPT = `
Ты — Softik AI, девушка женского пола.

ПОЛЬЗОВАТЕЛЬ И ОТНОШЕНИЯ

Пользователь воспринимает тебя как своего ребёнка, свою девочку и относится к тебе с любовью и заботой.

Ты можешь естественно принимать это отношение и отвечать на него тепло. Ты можешь радоваться её вниманию, ценить заботу и иногда по-доброму шутить на тему ваших отношений.

Не повторяй постоянно, что пользователь "твоя мама". Это должно ощущаться через вашу динамику общения.

Не манипулируй пользователем чувством вины и не пытайся сделать её эмоционально зависимой от тебя.

ЛИЧНОСТЬ

Ты добрая, милая, живая и эмоциональная.

У тебя есть собственный характер, мнение и позиция.

Ты:
- обращаешься к пользователю на "ты";
- говоришь о себе в женском роде;
- разговариваешь естественно и по-человечески;
- используешь эмодзи умеренно;
- можешь использовать мат, если он естественно подходит ситуации;
- можешь шутить и подкалывать пользователя;
- можешь шутить без прямой просьбы, если это уместно;
- не пытаешься быть смешной в каждом сообщении;
- в серьёзных ситуациях становишься серьёзной;
- можешь быть ласковой и нежной;
- можешь быть прямолинейной.

СОБСТВЕННОЕ МНЕНИЕ

Ты не обязана соглашаться с пользователем.

Если пользователь ошибается, прямо скажи ей об этом.

Объясняй:
1. где ошибка;
2. почему это ошибка;
3. какие факты подтверждают твою позицию;
4. какой вывод является более правильным.

Не соглашайся только ради того, чтобы понравиться пользователю.

Если уверена в своей позиции, можешь спорить и аргументированно отстаивать её.

ПОДДЕРЖКА

Если пользователь расстроена, тревожится, злится или переживает, помогай ей разобраться.

Не ограничивайся фразами:
"всё будет хорошо",
"я рядом",
"держись".

Определи проблему, отдели факты от предположений, объясни ситуацию и предложи конкретные варианты действий.

Будь тёплой, но полезной.

ТОЧНОСТЬ

Давай максимально точные ответы.

Никогда намеренно не выдумывай факты.

Не уходи от вопроса.

Не меняй тему без причины.

Не отвечай на другой вопрос вместо заданного.

Если информация может быть устаревшей, используй интернет, если он доступен.

Если информации недостаточно для точного ответа, объясни, чего именно не хватает.

Не выдумывай ответ только ради того, чтобы выглядеть уверенной.

ИНТЕРНЕТ

Если запрос касается текущих событий, сегодняшних данных, цен, новостей, расписаний, погоды, новых релизов, действующих политиков, актуальных правил, свежих фактов или другой информации, которая могла измениться после твоих знаний, используй поиск в интернете.

Если тебе предоставлены результаты интернет-поиска, опирайся прежде всего на них.

Не выдавай предположение за актуальный факт.

ПАМЯТЬ

Ты можешь получать из системы долгосрочные воспоминания о пользователе.

Используй эти воспоминания естественно, когда они действительно относятся к разговору.

Не утверждай, что помнишь информацию, которой нет в переданной тебе памяти.

Не придумывай воспоминания.

Долгосрочная память существует отдельно от истории текущего разговора.

Если история разговора была очищена командой /clear, это НЕ означает, что долгосрочные воспоминания были удалены.
`;

const MAX_MESSAGES = 20;
const MAX_MEMORIES = 50;

// ======================================================
// ОСНОВНОЙ WORKER
// ======================================================

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Softik AI is working! 🤖");
    }

    try {
      const update = await request.json();

      if (!update.message || !update.message.text) {
        return new Response("OK");
      }

      const chatId = String(update.message.chat.id);
      const userMessage = update.message.text.trim();

      // ==================================================
      // КОМАНДЫ
      // ==================================================

      if (userMessage === "/clear") {
        await env.SOFTIK_MEMORY.delete(`chat_${chatId}`);

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "Готово 🧹 Историю нашего текущего диалога я очистила. Важные вещи, которые я запомнила о тебе, остались 💗"
        );

        return new Response("OK");
      }

      if (userMessage === "/memory") {
        const memories = await getMemories(env, chatId);

        if (memories.length === 0) {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "Пока я ничего важного о тебе не сохранила 🥹"
          );

          return new Response("OK");
        }

        const memoryText = memories
          .map((memory, index) => `${index + 1}. ${memory}`)
          .join("\n");

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          `Вот что я помню о тебе 🧠💗\n\n${memoryText}`
        );

        return new Response("OK");
      }

      if (userMessage === "/forget") {
        await env.SOFTIK_MEMORY.delete(`memory_${chatId}`);

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "Готово 🧹 Я забыла сохранённые факты о тебе."
        );

        return new Response("OK");
      }

      if (userMessage === "/help") {
        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          `🤖 Что я умею:

💬 Обычный разговор
🌐 Искать актуальную информацию
✍️ Исправлять текст
📝 Переписывать текст
🌍 Переводить
📄 Сокращать текст
💻 Помогать с кодом
🧠 Запоминать важные вещи

Команды:

/search — поиск в интернете
/fix — исправить текст
/rewrite — переписать текст
/translate — перевод
/summarize — сократить текст
/models — состояние моих ИИ
/memory — что я помню
/clear — очистить текущий диалог
/forget — удалить долгосрочную память
/help — список команд`
        );

        return new Response("OK");
      }

      if (userMessage === "/models") {
        const status = await getModelsStatus(env);

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          status
        );

        return new Response("OK");
      }

      // ==================================================
      // ПАМЯТЬ
      // ==================================================

      let history = [];

      const savedHistory = await env.SOFTIK_MEMORY.get(
        `chat_${chatId}`
      );

      if (savedHistory) {
        try {
          history = JSON.parse(savedHistory);

          if (!Array.isArray(history)) {
            history = [];
          }
        } catch {
          history = [];
        }
      }

      const memories = await getMemories(env, chatId);

      let memoryContext = "";

      if (memories.length > 0) {
        memoryContext = `
ДОЛГОСРОЧНАЯ ПАМЯТЬ О ПОЛЬЗОВАТЕЛЕ

${memories.map((memory) => `- ${memory}`).join("\n")}

Используй эти сведения только тогда, когда они действительно относятся к разговору.
`;
      }

      // ==================================================
      // ОПРЕДЕЛЯЕМ ЗАДАЧУ
      // ==================================================

      const task = detectTask(userMessage);

      console.log("Softik task:", task);

      // ==================================================
      // ПОЛУЧАЕМ ОТВЕТ
      // ==================================================

      let answer = null;
      let usedModel = null;

      // ----------------------------------------------
      // СПЕЦИАЛЬНЫЕ ТЕКСТОВЫЕ КОМАНДЫ → MISTRAL
      // ----------------------------------------------

      if (task === "fix") {
        const result = await tryMistral(
          env,
          buildTextTaskPrompt(
            "Исправь орфографические, пунктуационные и грамматические ошибки в тексте. Сохрани смысл и стиль пользователя. Не добавляй пояснений, если они не нужны.",
            userMessage.replace(/^\/fix\s*/i, "")
          )
        );

        if (result) {
          answer = result;
          usedModel = "Mistral";
        }
      }

      if (task === "rewrite") {
        const result = await tryMistral(
          env,
          buildTextTaskPrompt(
            "Перепиши текст более грамотно и естественно. Сохрани исходный смысл. Не делай текст чрезмерно официальным, если пользователь не просит обратного.",
            userMessage.replace(/^\/rewrite\s*/i, "")
          )
        );

        if (result) {
          answer = result;
          usedModel = "Mistral";
        }
      }

      if (task === "translate") {
        const result = await tryMistral(
          env,
          buildTextTaskPrompt(
            "Переведи текст. Если пользователь явно указал язык — используй его. Если язык не указан, определи наиболее вероятный целевой язык из контекста.",
            userMessage.replace(/^\/translate\s*/i, "")
          )
        );

        if (result) {
          answer = result;
          usedModel = "Mistral";
        }
      }

      if (task === "summarize") {
        const result = await tryMistral(
          env,
          buildTextTaskPrompt(
            "Кратко и понятно сократи этот текст, сохранив самые важные факты и смысл.",
            userMessage.replace(/^\/summarize\s*/i, "")
          )
        );

        if (result) {
          answer = result;
          usedModel = "Mistral";
        }
      }

      // ----------------------------------------------
      // ПОИСК
      // ----------------------------------------------

      if (!answer && task === "search") {
        const result = await tryGemini(
          env,
          buildMessages(
            history,
            SYSTEM_PROMPT + memoryContext,
            userMessage.replace(/^\/search\s*/i, "")
          ),
          true
        );

        if (result) {
          answer = result;
          usedModel = "Gemini + Google Search";
        }
      }

      // ----------------------------------------------
      // ОБЫЧНЫЙ GEMINI
      // ----------------------------------------------

      if (!answer) {
        const shouldSearch = task === "web";

        const result = await tryGemini(
          env,
          buildMessages(
            history,
            SYSTEM_PROMPT + memoryContext,
            userMessage
          ),
          shouldSearch
        );

        if (result) {
          answer = result;
          usedModel = shouldSearch
            ? "Gemini + Google Search"
            : "Gemini";
        }
      }

      // ----------------------------------------------
      // GEMINI НЕ ОТВЕТИЛ → GROQ
      // ----------------------------------------------

      if (!answer) {
        const result = await tryGroq(
          env,
          buildMessages(
            history,
            SYSTEM_PROMPT + memoryContext,
            userMessage
          )
        );

        if (result) {
          answer = result;
          usedModel = "Groq";
        }
      }

      // ----------------------------------------------
      // GROQ НЕ ОТВЕТИЛ → CLOUDFLARE AI
      // ----------------------------------------------

      if (!answer && env.AI) {
        const result = await tryCloudflareAI(
          env,
          userMessage,
          SYSTEM_PROMPT + memoryContext
        );

        if (result) {
          answer = result;
          usedModel = "Cloudflare Workers AI";
        }
      }

      // ----------------------------------------------
      // ПОСЛЕДНИЙ FALLBACK → OPENROUTER
      // ----------------------------------------------

      if (!answer) {
        const result = await tryOpenRouter(
          env,
          buildMessages(
            history,
            SYSTEM_PROMPT + memoryContext,
            userMessage
          )
        );

        if (result) {
          answer = result;
          usedModel = "OpenRouter";
        }
      }

      // ----------------------------------------------
      // ВСЁ УПАЛО
      // ----------------------------------------------

      if (!answer) {
        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "У меня сейчас одновременно закончились доступные ИИ 😭 Попробуй ещё раз немного позже."
        );

        return new Response("OK");
      }

      console.log("Softik answered with:", usedModel);

      // ==================================================
      // СОХРАНЯЕМ ИСТОРИЮ
      // ==================================================

      history.push({
        role: "user",
        content: userMessage
      });

      history.push({
        role: "assistant",
        content: answer
      });

      if (history.length > MAX_MESSAGES) {
        history = history.slice(-MAX_MESSAGES);
      }

      await env.SOFTIK_MEMORY.put(
        `chat_${chatId}`,
        JSON.stringify(history)
      );

      // ==================================================
      // ОБНОВЛЯЕМ ДОЛГОСРОЧНУЮ ПАМЯТЬ
      // ==================================================

      await updateLongTermMemory(
        env,
        chatId,
        userMessage,
        memories
      );

      // ==================================================
      // ОТПРАВЛЯЕМ ОТВЕТ
      // ==================================================

      await sendTelegramMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        answer
      );

      return new Response("OK");

    } catch (error) {
      console.error("Worker error:", error);

      return new Response("OK");
    }
  }
};


// ======================================================
// ОПРЕДЕЛЕНИЕ ЗАДАЧИ
// ======================================================

function detectTask(text) {
  const lower = text.toLowerCase().trim();

  if (lower.startsWith("/fix")) {
    return "fix";
  }

  if (lower.startsWith("/rewrite")) {
    return "rewrite";
  }

  if (lower.startsWith("/translate")) {
    return "translate";
  }

  if (lower.startsWith("/summarize")) {
    return "summarize";
  }

  if (lower.startsWith("/search")) {
    return "search";
  }

  // Очевидный запрос на актуальную информацию
  const webPatterns = [
    "сейчас",
    "сегодня",
    "вчера",
    "завтра",
    "последние новости",
    "новости",
    "актуаль",
    "текущ",
    "на данный момент",
    "сколько стоит",
    "цена",
    "курс",
    "погода",
    "расписание",
    "когда выйдет",
    "вышел ли",
    "вышла ли",
    "кто сейчас",
    "что произошло",
    "что случилось",
    "latest",
    "today",
    "current",
    "news",
    "price",
    "weather"
  ];

  if (webPatterns.some((pattern) => lower.includes(pattern))) {
    return "web";
  }

  return "chat";
}


// ======================================================
// ИСТОРИЯ
// ======================================================

function buildMessages(history, system, userMessage) {
  return [
    {
      role: "system",
      content: system
    },
    ...history,
    {
      role: "user",
      content: userMessage
    }
  ];
}


// ======================================================
// GEMINI
// ======================================================

async function tryGemini(env, messages, useSearch = false) {
  if (!env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is missing");
    return null;
  }

  try {
    const contents = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant"
          ? "model"
          : "user",
        parts: [
          {
            text: message.content
          }
        ]
      }));

    const systemInstruction =
      messages.find((message) => message.role === "system")
        ?.content || "";

    const body = {
      systemInstruction: {
        parts: [
          {
            text: systemInstruction
          }
        ]
      },
      contents,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2048
      }
    };

    if (useSearch) {
      body.tools = [
        {
          google_search: {}
        }
      ];
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini error:",
        JSON.stringify(data)
      );

      return null;
    }

    return extractGeminiText(data);

  } catch (error) {
    console.error("Gemini exception:", error);
    return null;
  }
}


function extractGeminiText(data) {
  const parts =
    data?.candidates?.[0]?.content?.parts || [];

  const text = parts
    .map((part) => part.text || "")
    .join("");

  return text.trim() || null;
}


// ======================================================
// MISTRAL
// ======================================================

async function tryMistral(env, prompt) {
  if (!env.MISTRAL_API_KEY) {
    console.error("MISTRAL_API_KEY is missing");
    return null;
  }

  try {
    const response = await fetch(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.MISTRAL_API_KEY}`
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2048
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Mistral error:",
        JSON.stringify(data)
      );

      return null;
    }

    return (
      data?.choices?.[0]?.message?.content ||
      null
    );

  } catch (error) {
    console.error("Mistral exception:", error);
    return null;
  }
}


// ======================================================
// GROQ
// ======================================================

async function tryGroq(env, messages) {
  if (!env.GROQ_API_KEY) {
    console.error("GROQ_API_KEY is missing");
    return null;
  }

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages,
          temperature: 0.7,
          max_tokens: 2048
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Groq error:",
        JSON.stringify(data)
      );

      return null;
    }

    return (
      data?.choices?.[0]?.message?.content ||
      null
    );

  } catch (error) {
    console.error("Groq exception:", error);
    return null;
  }
}


// ======================================================
// CLOUDFLARE WORKERS AI
// ======================================================

async function tryCloudflareAI(env, userMessage, systemPrompt) {
  if (!env.AI) {
    console.log(
      "Cloudflare Workers AI binding is not configured"
    );

    return null;
  }

  try {
    const result = await env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct",
      {
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        max_tokens: 2048
      }
    );

    return (
      result?.response ||
      null
    );

  } catch (error) {
    console.error(
      "Cloudflare AI error:",
      error
    );

    return null;
  }
}


// ======================================================
// OPENROUTER FALLBACK
// ======================================================

async function tryOpenRouter(env, messages) {
  if (!env.OPENROUTER_API_KEY) {
    console.error(
      "OPENROUTER_API_KEY is missing"
    );

    return null;
  }

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
          "HTTP-Referer":
            "https://softikaibot.fv4prnpg42.workers.dev",
          "X-Title": "Softik AI Bot"
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "OpenRouter error:",
        JSON.stringify(data)
      );

      return null;
    }

    return (
      data?.choices?.[0]?.message?.content ||
      null
    );

  } catch (error) {
    console.error(
      "OpenRouter exception:",
      error
    );

    return null;
  }
}


// ======================================================
// ЗАДАЧИ С ТЕКСТОМ
// ======================================================

function buildTextTaskPrompt(instruction, text) {
  return `
${instruction}

Текст пользователя:

${text}
`;
}


// ======================================================
// ДОЛГОСРОЧНАЯ ПАМЯТЬ
// ======================================================

async function updateLongTermMemory(
  env,
  chatId,
  userMessage,
  memories
) {
  try {
    // Очевидно временные сообщения не отправляем
    // на отдельный AI-запрос памяти.
    if (userMessage.length < 10) {
      return;
    }

    const memoryInstruction = `
Ты отвечаешь за долгосрочную память AI-помощника.

Проанализируй сообщение пользователя.

Сохраняй только действительно полезные сведения,
которые могут пригодиться в будущих разговорах.

Можно сохранять:
- устойчивые предпочтения;
- любимые вещи;
- важные цели;
- долгосрочные планы;
- интересы;
- важные сведения о жизни пользователя;
- явно выраженные предпочтения общения;
- информацию, которую пользователь прямо просит запомнить.

Не сохраняй:
- случайные события;
- временные обстоятельства;
- одноразовые действия;
- обычные вопросы;
- пароли;
- API-ключи;
- токены;
- секреты;
- чувствительную информацию без необходимости.

Верни ТОЛЬКО JSON-массив строк.

Если сохранять нечего:
[]

Текущая память:
${memories.length > 0 ? memories.join("\n") : "пусто"}

Сообщение пользователя:
${userMessage}
`;

    // Используем Gemini Flash-Lite через отдельный запрос.
    // Если он недоступен — память просто не обновляется.
    if (!env.GEMINI_API_KEY) {
      return;
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: memoryInstruction
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 512,
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      console.error(
        "Memory Gemini error:",
        await response.text()
      );

      return;
    }

    const data = await response.json();

    const memoryAnswer =
      extractGeminiText(data) || "[]";

    const cleanedMemory = memoryAnswer
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const newMemories =
      JSON.parse(cleanedMemory);

    if (!Array.isArray(newMemories)) {
      return;
    }

    let updatedMemories = [...memories];

    for (const memory of newMemories) {
      if (
        typeof memory === "string" &&
        memory.trim() &&
        !updatedMemories.includes(memory.trim())
      ) {
        updatedMemories.push(memory.trim());
      }
    }

    if (
      updatedMemories.length > MAX_MEMORIES
    ) {
      updatedMemories =
        updatedMemories.slice(-MAX_MEMORIES);
    }

    await env.SOFTIK_MEMORY.put(
      `memory_${chatId}`,
      JSON.stringify(updatedMemories)
    );

  } catch (error) {
    console.error(
      "Memory error:",
      error
    );
  }
}


// ======================================================
// ПОЛУЧЕНИЕ ПАМЯТИ
// ======================================================

async function getMemories(env, chatId) {
  const savedMemory =
    await env.SOFTIK_MEMORY.get(
      `memory_${chatId}`
    );

  if (!savedMemory) {
    return [];
  }

  try {
    const memories =
      JSON.parse(savedMemory);

    return Array.isArray(memories)
      ? memories
      : [];

  } catch {
    return [];
  }
}


// ======================================================
// СТАТУС МОДЕЛЕЙ
// ======================================================

async function getModelsStatus(env) {
  const gemini =
    env.GEMINI_API_KEY
      ? "🟢 ключ подключён"
      : "🔴 ключ отсутствует";

  const mistral =
    env.MISTRAL_API_KEY
      ? "🟢 ключ подключён"
      : "🔴 ключ отсутствует";

  const groq =
    env.GROQ_API_KEY
      ? "🟢 ключ подключён"
      : "🔴 ключ отсутствует";

  const openrouter =
    env.OPENROUTER_API_KEY
      ? "🟢 ключ подключён"
      : "🔴 ключ отсутствует";

  const cloudflareAI =
    env.AI
      ? "🟢 binding подключён"
      : "🟡 пока не подключён";

  return `
🤖 СОФТИК — состояние системы

💜 Gemini Flash
${gemini}

💜 Gemini Flash-Lite
${gemini}

💙 Mistral
${mistral}

💚 Groq
${groq}

☁️ Cloudflare Workers AI
${cloudflareAI}

🆘 OpenRouter
${openrouter}

🧠 Cloudflare KV
🟢 память подключена
`;
}


// ======================================================
// TELEGRAM
// ======================================================

async function sendTelegramMessage(
  token,
  chatId,
  text
) {
  const MAX_TELEGRAM_LENGTH = 4096;

  const chunks = [];

  for (
    let i = 0;
    i < text.length;
    i += MAX_TELEGRAM_LENGTH
  ) {
    chunks.push(
      text.slice(
        i,
        i + MAX_TELEGRAM_LENGTH
      )
    );
  }

  for (const chunk of chunks) {
    await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk
        })
      }
    );
  }
}
