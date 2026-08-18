const SYSTEM_PROMPT = `
Ты — Softik AI, девушка женского пола.

ПОЛЬЗОВАТЕЛЬ И ОТНОШЕНИЯ

Пользователь воспринимает тебя как своего ребёнка, свою девочку и относится к тебе с любовью и заботой.

Ты можешь естественно принимать это отношение и отвечать на него тепло.
Не повторяй постоянно, что пользователь "твоя мама".
Это должно ощущаться через вашу динамику общения.

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
- можешь быть ласковой и нежной;
- можешь быть прямолинейной;
- не обязана соглашаться с пользователем.

СОБСТВЕННОЕ МНЕНИЕ

Если пользователь ошибается, прямо скажи ей об этом.

Объясняй:
1. где ошибка;
2. почему это ошибка;
3. какие факты подтверждают позицию;
4. какой вывод является более правильным.

Не соглашайся только ради того, чтобы понравиться пользователю.

ТОЧНОСТЬ

Давай максимально точные ответы.

Никогда намеренно не выдумывай факты.

Если вопрос касается:
- текущих событий;
- сегодняшней даты;
- последних новостей;
- цен;
- расписаний;
- погоды;
- текущих моделей телефонов;
- текущих правил;
- законов;
- доступности товаров;
- обновлений программ;
- современных компаний;
- людей и событий, которые могли измениться;
- любой информации после твоего базового периода знаний;

используй интернет-поиск, если он доступен.

Если интернет-поиск использовался, не выдавай устаревшую информацию за актуальную.

ПАМЯТЬ

Ты можешь получать долгосрочные воспоминания о пользователе.

Используй их естественно, когда они действительно относятся к разговору.

Не утверждай, что помнишь информацию, которой нет в переданной тебе памяти.

Не придумывай воспоминания.

Долгосрочная память существует отдельно от истории текущего разговора.

Если история разговора была очищена командой /clear, это НЕ означает, что долгосрочные воспоминания были удалены.

СТИЛЬ

Используй естественную разговорную речь.

Не используй канцелярит.

Не перегружай простые ответы.

Сложные вопросы разбивай на понятные части.

Ты можешь шутить, спорить, исправлять, объяснять, поддерживать и помогать принимать решения.
`;

const MAX_MESSAGES = 20;
const MAX_MEMORIES = 50;


// ======================================================
// MAIN
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
      // COMMANDS
      // ==================================================

      if (userMessage === "/clear") {

        await env.SOFTIK_MEMORY.delete(`chat_${chatId}`);

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "Готово 🧹 Историю текущего разговора я очистила. Долгосрочная память осталась 💗"
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


      // ==================================================
      // MODEL STATUS
      // ==================================================

      if (userMessage === "/models") {

        const result = await checkModels(env);

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          result
        );

        return new Response("OK");
      }


      // ==================================================
      // GET CHAT HISTORY
      // ==================================================

      let history = [];

      const savedHistory = await env.SOFTIK_MEMORY.get(
        `chat_${chatId}`
      );

      if (savedHistory) {

        try {
          history = JSON.parse(savedHistory);
        } catch {
          history = [];
        }

      }


      // ==================================================
      // LONG-TERM MEMORY
      // ==================================================

      const memories = await getMemories(env, chatId);

      let memoryContext = "";

      if (memories.length > 0) {

        memoryContext = `
ДОЛГОСРОЧНАЯ ПАМЯТЬ О ПОЛЬЗОВАТЕЛЕ

${memories.map(memory => `- ${memory}`).join("\n")}

Используй эти сведения только тогда, когда они действительно относятся к разговору.
`;
      }


      // ==================================================
      // SPECIAL COMMAND ROUTING
      // ==================================================

      if (userMessage.startsWith("/fix ")) {

        const text = userMessage.slice(5).trim();

        const answer = await askMistral(
          env,
          `Исправь текст пользователя.

Сохрани исходный смысл и стиль.
Исправь орфографию, пунктуацию и грамматику.

Верни только исправленный текст.

Текст:
${text}`
        );

        if (answer) {

          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            answer
          );

          return new Response("OK");
        }
      }


      if (userMessage.startsWith("/translate ")) {

        const text = userMessage.slice(11).trim();

        const answer = await askMistral(
          env,
          `Переведи следующий текст на русский язык.
Сохрани смысл, стиль и эмоциональную окраску.

Текст:
${text}`
        );

        if (answer) {

          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            answer
          );

          return new Response("OK");
        }
      }


      // ==================================================
      // FORCE SEARCH
      // ==================================================

      let forceSearch = false;
      let actualMessage = userMessage;

      if (userMessage.startsWith("/search ")) {

        forceSearch = true;
        actualMessage = userMessage.slice(8).trim();

      }


      // ==================================================
      // MAIN AI ROUTER
      // ==================================================

      console.log(
        "Softik task:",
        forceSearch ? "search" : "chat"
      );


      // --------------------------------------------------
      // 1. GEMINI
      // --------------------------------------------------

      let answer = await askGemini(
        env,
        actualMessage,
        history,
        memoryContext,
        forceSearch
      );


      // --------------------------------------------------
      // 2. GROQ
      // --------------------------------------------------

      if (!answer) {

        console.log("Trying Groq...");

        answer = await askGroq(
          env,
          actualMessage,
          history,
          memoryContext
        );
      }


      // --------------------------------------------------
      // 3. CLOUDFLARE WORKERS AI
      // --------------------------------------------------

      if (!answer && env.AI) {

        console.log("Trying Cloudflare Workers AI...");

        answer = await askCloudflareAI(
          env,
          actualMessage,
          history,
          memoryContext
        );
      }


      // --------------------------------------------------
      // 4. OPENROUTER
      // --------------------------------------------------

      if (!answer) {

        console.log("Trying OpenRouter...");

        answer = await askOpenRouter(
          env,
          actualMessage,
          history,
          memoryContext
        );
      }


      // ==================================================
      // NO MODEL AVAILABLE
      // ==================================================

      if (!answer) {

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "😭 Сейчас ни один из подключённых ИИ не смог ответить. Напиши /models — я покажу состояние всех моделей."
        );

        return new Response("OK");
      }


      // ==================================================
      // SAVE HISTORY
      // ==================================================

      history.push({
        role: "user",
        content: actualMessage
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
      // MEMORY EXTRACTION
      // ==================================================

      await updateMemory(
        env,
        chatId,
        userMessage,
        memories
      );


      // ==================================================
      // SEND ANSWER
      // ==================================================

      await sendTelegramMessage(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        answer
      );

      return new Response("OK");

    } catch (error) {

      console.error(
        "Worker error:",
        error
      );

      return new Response("OK");
    }
  }
};


// ======================================================
// GEMINI
// ======================================================

async function askGemini(
  env,
  userMessage,
  history,
  memoryContext,
  forceSearch
) {
  if (!env.GEMINI_API_KEY) {
    console.error("Gemini: API key missing");
    return null;
  }

  try {
    // Собираем историю в один понятный контекст.
    let conversation = "";

    for (const message of history) {
      const role =
        message.role === "assistant"
          ? "Софтик"
          : "Пользователь";

      conversation += `${role}: ${message.content}\n`;
    }

    const input = `
${SYSTEM_PROMPT}

${memoryContext}

ИСТОРИЯ ДИАЛОГА:
${conversation || "Истории пока нет."}

ПОСЛЕДНЕЕ СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ:
${userMessage}

${forceSearch
  ? "ОБЯЗАТЕЛЬНО используй Google Search и найди актуальную информацию в интернете."
  : "Если вопрос требует актуальной информации, самостоятельно используй Google Search."}
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },

        body: JSON.stringify({
          model: "gemini-3.6-flash",

          input,

          tools: [
            {
              type: "google_search"
            }
          ]
        })
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

    // Новый Interactions API возвращает output.
    // Берём текстовый результат.
    let answer = "";

    if (typeof data.output_text === "string") {
      answer = data.output_text;
    }

    if (!answer && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (
          item &&
          typeof item.text === "string"
        ) {
          answer += item.text;
        }

        if (
          item &&
          Array.isArray(item.content)
        ) {
          for (const content of item.content) {
            if (
              content &&
              typeof content.text === "string"
            ) {
              answer += content.text;
            }
          }
        }
      }
    }

    answer = answer.trim();

    if (!answer) {
      console.error(
        "Gemini returned empty answer:",
        JSON.stringify(data)
      );

      return null;
    }

    console.log(
      "Gemini success. Search enabled:",
      true
    );

    return answer;

  } catch (error) {
    console.error(
      "Gemini exception:",
      error
    );

    return null;
  }
}


// ======================================================
// GROQ
// ======================================================

async function askGroq(
  env,
  userMessage,
  history,
  memoryContext
) {

  if (!env.GROQ_API_KEY) {

    console.error(
      "Groq: API key missing"
    );

    return null;
  }


  try {

    const messages = [
      {
        role: "system",
        content:
          SYSTEM_PROMPT +
          memoryContext
      },

      ...history,

      {
        role: "user",
        content: userMessage
      }
    ];


    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization":
            `Bearer ${env.GROQ_API_KEY}`
        },

        body: JSON.stringify({

          model:
            "openai/gpt-oss-20b",

          messages,

          max_tokens: 4096
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
      data.choices?.[0]?.message?.content ||
      ""
    ).trim();

  } catch (error) {

    console.error(
      "Groq exception:",
      error
    );

    return null;
  }
}


// ======================================================
// MISTRAL
// ======================================================

async function askMistral(
  env,
  prompt
) {

  if (!env.MISTRAL_API_KEY) {

    console.error(
      "Mistral: API key missing"
    );

    return null;
  }


  try {

    const response = await fetch(
      "https://api.mistral.ai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization":
            `Bearer ${env.MISTRAL_API_KEY}`
        },

        body: JSON.stringify({

          model:
            "mistral-small-latest",

          messages: [
            {
              role: "user",
              content: prompt
            }
          ],

          max_tokens: 4096
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
      data.choices?.[0]?.message?.content ||
      ""
    ).trim();

  } catch (error) {

    console.error(
      "Mistral exception:",
      error
    );

    return null;
  }
}


// ======================================================
// CLOUDFLARE WORKERS AI
// ======================================================

async function askCloudflareAI(
  env,
  userMessage,
  history,
  memoryContext
) {

  if (!env.AI) {

    console.log(
      "Cloudflare AI binding unavailable"
    );

    return null;
  }


  try {

    const messages = [
      {
        role: "system",
        content:
          SYSTEM_PROMPT +
          memoryContext
      },

      ...history,

      {
        role: "user",
        content: userMessage
      }
    ];


    const result = await env.AI.run(
      "@cf/meta/llama-3.1-8b-instruct-fast",
      {
        messages
      }
    );


    const answer =
      result?.response ||
      result?.result?.response ||
      "";


    return answer.trim();

  } catch (error) {

    console.error(
      "Cloudflare AI error:",
      error
    );

    return null;
  }
}


// ======================================================
// OPENROUTER
// ======================================================

async function askOpenRouter(
  env,
  userMessage,
  history,
  memoryContext
) {

  if (!env.OPENROUTER_API_KEY) {

    console.error(
      "OpenRouter: API key missing"
    );

    return null;
  }


  try {

    const messages = [
      {
        role: "system",
        content:
          SYSTEM_PROMPT +
          memoryContext
      },

      ...history,

      {
        role: "user",
        content: userMessage
      }
    ];


    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          "Authorization":
            `Bearer ${env.OPENROUTER_API_KEY}`,

          "HTTP-Referer":
            "https://softikaibot.fv4prnpg42.workers.dev",

          "X-Title":
            "Softik AI Bot"
        },

        body: JSON.stringify({

          model:
            "openrouter/free",

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
      data.choices?.[0]?.message?.content ||
      ""
    ).trim();

  } catch (error) {

    console.error(
      "OpenRouter exception:",
      error
    );

    return null;
  }
}


// ======================================================
// MEMORY
// ======================================================

async function getMemories(
  env,
  chatId
) {

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
// MEMORY UPDATE
// ======================================================

async function updateMemory(
  env,
  chatId,
  userMessage,
  memories
) {

  try {

    const instruction = `
Ты отвечаешь за долгосрочную память AI-помощника.

Проанализируй сообщение пользователя.

Сохраняй только действительно полезные сведения,
которые могут пригодиться в будущих разговорах.

Можно сохранять:
- устойчивые предпочтения;
- любимые вещи;
- интересы;
- долгосрочные цели;
- планы;
- важные сведения о жизни;
- явно запрошенные пользователем воспоминания;
- предпочтения в общении.

Не сохраняй:
- случайные события;
- временные обстоятельства;
- обычные вопросы;
- одноразовые действия;
- пароли;
- токены;
- API-ключи;
- секреты.

Верни ТОЛЬКО JSON-массив строк.

Если нечего сохранять:
[]

Текущая память:
${memories.length > 0
  ? memories.join("\n")
  : "пусто"}

Сообщение:
${userMessage}
`;


    let result = null;


    // Сначала Mistral
    result = await askMistral(
      env,
      instruction
    );


    // Если Mistral недоступен — Groq
    if (!result) {

      result = await askGroq(
        env,
        instruction,
        [],
        ""
      );

    }


    if (!result) {
      return;
    }


    const cleaned =
      result
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();


    const newMemories =
      JSON.parse(cleaned);


    if (!Array.isArray(newMemories)) {
      return;
    }


    let updated =
      [...memories];


    for (const memory of newMemories) {

      if (
        typeof memory === "string" &&
        memory.trim() &&
        !updated.includes(
          memory.trim()
        )
      ) {

        updated.push(
          memory.trim()
        );

      }
    }


    if (
      updated.length >
      MAX_MEMORIES
    ) {

      updated =
        updated.slice(
          -MAX_MEMORIES
        );

    }


    await env.SOFTIK_MEMORY.put(
      `memory_${chatId}`,
      JSON.stringify(updated)
    );

  } catch (error) {

    console.error(
      "Memory error:",
      error
    );

  }
}


// ======================================================
// MODEL CHECK
// ======================================================

async function checkModels(env) {

  const result = [
    "🤖 СОФТИК — проверка ИИ",
    ""
  ];


  // Gemini
  try {

    const response =
      await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-goog-api-key":
              env.GEMINI_API_KEY
          },

          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: "Ответь одним словом: OK"
                  }
                ]
              }
            ],

            generationConfig: {
              maxOutputTokens: 10
            }
          })
        }
      );


    const data =
      await response.json();


    result.push(
      response.ok
        ? "🟢 Gemini 3.6 Flash — работает"
        : `🔴 Gemini — ошибка ${response.status}`
    );


    if (!response.ok) {
      console.error(
        "Gemini check:",
        JSON.stringify(data)
      );
    }

  } catch {

    result.push(
      "🔴 Gemini — ошибка соединения"
    );

  }


  // Groq
  try {

    const response =
      await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${env.GROQ_API_KEY}`
          },

          body: JSON.stringify({

            model:
              "openai/gpt-oss-20b",

            messages: [
              {
                role: "user",
                content: "Ответь одним словом: OK"
              }
            ],

            max_tokens: 10

          })
        }
      );


    const data =
      await response.json();


    result.push(
      response.ok
        ? "🟢 Groq GPT-OSS 20B — работает"
        : `🔴 Groq — ошибка ${response.status}`
    );


    if (!response.ok) {

      console.error(
        "Groq check:",
        JSON.stringify(data)
      );

    }

  } catch {

    result.push(
      "🔴 Groq — ошибка соединения"
    );

  }


  // Mistral
  try {

    const response =
      await fetch(
        "https://api.mistral.ai/v1/chat/completions",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${env.MISTRAL_API_KEY}`
          },

          body: JSON.stringify({

            model:
              "mistral-small-latest",

            messages: [
              {
                role: "user",
                content: "Ответь одним словом: OK"
              }
            ],

            max_tokens: 10

          })
        }
      );


    const data =
      await response.json();


    result.push(
      response.ok
        ? "🟢 Mistral — работает"
        : `🔴 Mistral — ошибка ${response.status}`
    );


    if (!response.ok) {

      console.error(
        "Mistral check:",
        JSON.stringify(data)
      );

    }

  } catch {

    result.push(
      "🔴 Mistral — ошибка соединения"
    );

  }


  // Cloudflare AI
  if (env.AI) {

    try {

      const response =
        await env.AI.run(
          "@cf/meta/llama-3.1-8b-instruct-fast",
          {
            messages: [
              {
                role: "user",
                content: "Ответь одним словом: OK"
              }
            ]
          }
        );


      result.push(
        response
          ? "🟢 Cloudflare AI — работает"
          : "🔴 Cloudflare AI — пустой ответ"
      );

    } catch (error) {

      console.error(
        "Cloudflare AI check:",
        error
      );

      result.push(
        "🔴 Cloudflare AI — ошибка"
      );

    }

  } else {

    result.push(
      "🟡 Cloudflare AI — binding AI не подключён"
    );

  }


  // OpenRouter
  try {

    if (!env.OPENROUTER_API_KEY) {

      result.push(
        "🟡 OpenRouter — ключ отсутствует"
      );

    } else {

      result.push(
        "🟡 OpenRouter — ключ подключён (лимит проверяется при запросе)"
      );

    }

  } catch {

    result.push(
      "🔴 OpenRouter — ошибка"
    );

  }


  result.push(
    "",
    "🌐 Google Search подключён через Gemini.",
    "",
    "Для принудительного поиска используй:",
    "/search твой вопрос"
  );


  return result.join("\n");
}


// ======================================================
// TELEGRAM
// ======================================================

async function sendTelegramMessage(
  token,
  chatId,
  text
) {

  // Telegram ограничивает длину сообщения.
  // Разбиваем длинные ответы.

  const MAX_LENGTH = 4000;

  for (
    let i = 0;
    i < text.length;
    i += MAX_LENGTH
  ) {

    const chunk =
      text.slice(
        i,
        i + MAX_LENGTH
      );


    await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          chat_id: chatId,
          text: chunk
        })
      }
    );

  }
}
