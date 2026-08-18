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

используй веб-поиск, если он доступен.

Если веб-поиск был использован:
- опирайся на найденные источники;
- не выдавай старую информацию за актуальную;
- не придумывай источники;
- в конце ответа добавляй раздел "🔗 Источники:" с реальными URL.

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
const MAX_SEARCH_RESULTS = 5;

const GEMINI_MODEL = "gemini-3.6-flash";
const GROQ_MODEL = "openai/gpt-oss-20b";
const MISTRAL_MODEL = "mistral-small-latest";
const CLOUDFLARE_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";


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
      // /clear
      // ==================================================

      if (userMessage === "/clear") {

        await env.SOFTIK_MEMORY.delete(`chat_${chatId}`);

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "Готово 🧹 Историю текущего разговора я очистила.\n\nДолгосрочная память осталась 💗"
        );

        return new Response("OK");
      }


      // ==================================================
      // /memory
      // ==================================================

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
          `🧠 Что я помню о тебе:\n\n${memoryText}`
        );

        return new Response("OK");
      }


      // ==================================================
      // /forget
      // ==================================================

      if (userMessage === "/forget") {

        await env.SOFTIK_MEMORY.delete(`memory_${chatId}`);

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "Готово 🧹 Я удалила всю долгосрочную память о тебе."
        );

        return new Response("OK");
      }


      // ==================================================
      // /models
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
      // /limit
      // ==================================================

      if (userMessage === "/limit") {

        const result = await checkLimits(env);

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          result
        );

        return new Response("OK");
      }


      // ==================================================
      // /help
      // ==================================================

      if (userMessage === "/help") {

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          `🤖 Softik AI — команды

🔎 /search — поиск в интернете
✏️ /fix — исправить текст
📝 /rewrite — переписать текст
🌍 /translate — перевод
📌 /summarize — сократить текст

🤖 /models — состояние ИИ
📊 /limit — лимиты и доступность API
🧠 /memory — что я помню
🧹 /clear — очистить текущий диалог
🗑 /forget — удалить долгосрочную память
❓ /help — список команд

💡 Обычные вопросы тоже могут автоматически отправляться в интернет-поиск, если для ответа нужна актуальная информация.`
        );

        return new Response("OK");
      }


      // ==================================================
      // HISTORY
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
      // /fix
      // ==================================================

      if (userMessage.startsWith("/fix ")) {

        const text = userMessage.slice(5).trim();

        if (!text) {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "✏️ После /fix напиши текст, который нужно исправить."
          );
          return new Response("OK");
        }

        const answer = await askMistral(
          env,
          `Исправь текст пользователя.

Сохрани исходный смысл, стиль и эмоциональную окраску.
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


      // ==================================================
      // /rewrite
      // ==================================================

      if (userMessage.startsWith("/rewrite ")) {

        const text = userMessage.slice(9).trim();

        if (!text) {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "📝 После /rewrite напиши текст, который нужно переписать."
          );
          return new Response("OK");
        }

        const answer = await askMistral(
          env,
          `Перепиши текст пользователя.

Сохрани исходный смысл.
Сделай текст более естественным, грамотным и связным.
Не добавляй новую информацию.
Сохрани эмоциональную окраску исходного текста.

Верни только переписанный текст.

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
      // /translate
      // ==================================================

      if (userMessage.startsWith("/translate ")) {

        const text = userMessage.slice(11).trim();

        if (!text) {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "🌍 После /translate напиши текст для перевода."
          );
          return new Response("OK");
        }

        const answer = await askMistral(
          env,
          `Определи язык исходного текста и переведи его на русский язык.

Сохрани:
- смысл;
- стиль;
- эмоциональную окраску;
- сленг, если он важен.

Верни только перевод.

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
      // /summarize
      // ==================================================

      if (userMessage.startsWith("/summarize ")) {

        const text = userMessage.slice(11).trim();

        if (!text) {
          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "📌 После /summarize напиши текст, который нужно сократить."
          );
          return new Response("OK");
        }

        const answer = await askMistral(
          env,
          `Сократи следующий текст.

Сохрани главную мысль, важные факты и выводы.
Удали повторы и второстепенные детали.
Не добавляй информацию от себя.

Верни краткую и понятную версию текста.

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
      // SEARCH
      // ==================================================

      let forceSearch = false;
      let actualMessage = userMessage;

      if (userMessage.startsWith("/search ")) {

        forceSearch = true;
        actualMessage = userMessage.slice(8).trim();

        if (!actualMessage) {

          await sendTelegramMessage(
            env.TELEGRAM_BOT_TOKEN,
            chatId,
            "🔎 После /search напиши вопрос или запрос."
          );

          return new Response("OK");
        }
      }


      // ==================================================
      // AUTOMATIC SEARCH
      // ==================================================

      const shouldSearch =
        forceSearch || needsWebSearch(actualMessage);


      let searchContext = "";

      if (shouldSearch) {

        searchContext =
          await performTavilySearch(
            env,
            actualMessage
          );
      }


      // ==================================================
      // AI ROUTER
      // ==================================================

      let answer = null;


      // 1. Gemini
      answer = await askGemini(
        env,
        actualMessage,
        history,
        memoryContext,
        searchContext
      );


      // 2. Groq
      if (!answer) {

        console.log("Trying Groq...");

        answer = await askGroq(
          env,
          actualMessage,
          history,
          memoryContext,
          searchContext
        );
      }


      // 3. Mistral
      if (!answer) {

        console.log("Trying Mistral...");

        answer = await askMistralChat(
          env,
          actualMessage,
          history,
          memoryContext,
          searchContext
        );
      }


      // 4. Cloudflare
      if (!answer && env.AI) {

        console.log("Trying Cloudflare AI...");

        answer = await askCloudflareAI(
          env,
          actualMessage,
          history,
          memoryContext,
          searchContext
        );
      }


      // 5. OpenRouter
      if (!answer) {

        console.log("Trying OpenRouter...");

        answer = await askOpenRouter(
          env,
          actualMessage,
          history,
          memoryContext,
          searchContext
        );
      }


      // ==================================================
      // NO MODEL
      // ==================================================

      if (!answer) {

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "😭 Сейчас ни один из подключённых ИИ не смог ответить.\n\nНапиши /models — я покажу состояние всех моделей."
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
      // MEMORY
      // ==================================================

      await updateMemory(
        env,
        chatId,
        userMessage,
        memories
      );


      // ==================================================
      // SEND
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
// AUTOMATIC SEARCH DETECTION
// ======================================================

function needsWebSearch(message) {

  const text = message.toLowerCase();

  const patterns = [
    "сейчас",
    "сегодня",
    "сегодняшн",
    "завтра",
    "вчера",
    "на данный момент",
    "актуальн",
    "последн",
    "свеж",
    "новост",
    "что нового",

    "погод",
    "температур",
    "осадк",
    "дождь",
    "снег",
    "ветер",

    "цена",
    "стоимость",
    "сколько стоит",
    "где купить",
    "купить",
    "в наличии",
    "доступен",
    "доступна",
    "распродаж",

    "новая модель",
    "последняя модель",
    "последняя версия",
    "новая версия",
    "обновление",
    "релиз",
    "вышел",
    "вышла",

    "когда будет",
    "когда состоится",
    "расписание",
    "ближайший",
    "ближайшая",
    "матч",
    "концерт",

    "найди",
    "поищи",
    "проверь в интернете",
    "посмотри в интернете",
    "что пишут в интернете",
    "источники",
    "ссылки",

    "кто сейчас",
    "где сейчас",
    "что случилось",
    "что произошло",

    "закон",
    "законы",
    "правила",
    "официально",
    "официальный сайт",

    "обзор",
    "отзывы",
    "сравни модели",
    "лучший",
    "лучшие"
  ];

  return patterns.some(
    pattern => text.includes(pattern)
  );
}


// ======================================================
// TAVILY
// ======================================================

async function performTavilySearch(env, query) {

  if (!env.TAVILY_API_KEY) {
    console.error("Tavily: API key missing");
    return "";
  }

  try {

    const response = await fetch(
      "https://api.tavily.com/search",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization":
            `Bearer ${env.TAVILY_API_KEY}`
        },

        body: JSON.stringify({
          query,
          search_depth: "basic",
          topic: "general",
          max_results: MAX_SEARCH_RESULTS,
          include_answer: false,
          include_raw_content: false,
          include_images: false
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {

      console.error(
        "Tavily error:",
        JSON.stringify(data)
      );

      return "";
    }

    if (
      !Array.isArray(data.results) ||
      data.results.length === 0
    ) {
      return "";
    }

    let context = `
РЕЗУЛЬТАТЫ ВЕБ-ПОИСКА TAVILY

Используй эти результаты как внешние источники.
Не придумывай сведения, которых нет в найденных материалах.

`;

    data.results.forEach((result, index) => {

      context += `
ИСТОЧНИК ${index + 1}
Название: ${result.title || "Без названия"}
URL: ${result.url || ""}
Содержание:
${result.content || ""}

`;
    });

    context += `
КОНЕЦ РЕЗУЛЬТАТОВ ПОИСКА
`;

    return context.trim();

  } catch (error) {

    console.error(
      "Tavily exception:",
      error
    );

    return "";
  }
}


// ======================================================
// GEMINI
// ======================================================

async function askGemini(
  env,
  userMessage,
  history,
  memoryContext,
  searchContext
) {

  if (!env.GEMINI_API_KEY) {
    return null;
  }

  try {

    let conversation = "";

    for (const message of history) {

      const role =
        message.role === "assistant"
          ? "Софтик"
          : "Пользователь";

      conversation +=
        `${role}: ${message.content}\n`;
    }

    const input = `
${SYSTEM_PROMPT}

${memoryContext}

${searchContext}

ИСТОРИЯ ДИАЛОГА:
${conversation || "Истории пока нет."}

ПОСЛЕДНЕЕ СООБЩЕНИЕ:
${userMessage}

${
  searchContext
    ? `
Для ответа используй найденные результаты.
Если найденные данные новее твоих внутренних знаний — отдавай им приоритет.

В конце ответа обязательно добавь:

🔗 Источники:
- Название источника — URL
`
    : ""
}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
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
                  text: input
                }
              ]
            }
          ],

          generationConfig: {
            maxOutputTokens: 4096
          }
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

    return (
      data.candidates?.[0]
        ?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim() || null
    );

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
  memoryContext,
  searchContext
) {

  if (!env.GROQ_API_KEY) {
    return null;
  }

  try {

    const messages = [
      {
        role: "system",
        content:
          SYSTEM_PROMPT +
          memoryContext +
          searchContext
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
          model: GROQ_MODEL,
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
      data.choices?.[0]
        ?.message?.content ||
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
// MISTRAL CHAT
// ======================================================

async function askMistralChat(
  env,
  userMessage,
  history,
  memoryContext,
  searchContext
) {

  if (!env.MISTRAL_API_KEY) {
    return null;
  }

  try {

    const messages = [
      {
        role: "system",
        content:
          SYSTEM_PROMPT +
          memoryContext +
          searchContext
      },

      ...history,

      {
        role: "user",
        content: userMessage
      }
    ];

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
          model: MISTRAL_MODEL,
          messages,
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
      data.choices?.[0]
        ?.message?.content ||
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
// MISTRAL SIMPLE
// ======================================================

async function askMistral(env, prompt) {

  return await askMistralChat(
    env,
    prompt,
    [],
    "",
    ""
  );
}


// ======================================================
// CLOUDFLARE AI
// ======================================================

async function askCloudflareAI(
  env,
  userMessage,
  history,
  memoryContext,
  searchContext
) {

  if (!env.AI) {
    return null;
  }

  try {

    const messages = [
      {
        role: "system",
        content:
          SYSTEM_PROMPT +
          memoryContext +
          searchContext
      },

      ...history,

      {
        role: "user",
        content: userMessage
      }
    ];

    const result = await env.AI.run(
      CLOUDFLARE_MODEL,
      {
        messages
      }
    );

    return (
      result?.response ||
      result?.result?.response ||
      ""
    ).trim();

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
  memoryContext,
  searchContext
) {

  if (!env.OPENROUTER_API_KEY) {
    return null;
  }

  try {

    const messages = [
      {
        role: "system",
        content:
          SYSTEM_PROMPT +
          memoryContext +
          searchContext
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
      data.choices?.[0]
        ?.message?.content ||
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
${
  memories.length > 0
    ? memories.join("\n")
    : "пусто"
}

Сообщение:
${userMessage}
`;

    let result =
      await askMistral(
        env,
        instruction
      );

    if (!result) {

      result =
        await askGroq(
          env,
          instruction,
          [],
          "",
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

    let updated = [...memories];

    for (const memory of newMemories) {

      if (
        typeof memory === "string" &&
        memory.trim() &&
        !updated.includes(memory.trim())
      ) {

        updated.push(
          memory.trim()
        );
      }
    }

    if (updated.length > MAX_MEMORIES) {

      updated =
        updated.slice(-MAX_MEMORIES);
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
    "🤖 СОФТИК — состояние ИИ",
    ""
  ];


  // GEMINI

  if (!env.GEMINI_API_KEY) {

    result.push(
      "🔴 Gemini 3.6 Flash — API ключ отсутствует"
    );

  } else {

    const check =
      await probeGemini(env);

    result.push(
      formatProviderStatus(
        "Gemini 3.6 Flash",
        check
      )
    );
  }


  // GROQ

  if (!env.GROQ_API_KEY) {

    result.push(
      "🔴 Groq GPT-OSS 20B — API ключ отсутствует"
    );

  } else {

    const check =
      await probeGroq(env);

    result.push(
      formatProviderStatus(
        "Groq GPT-OSS 20B",
        check
      )
    );
  }


  // MISTRAL

  if (!env.MISTRAL_API_KEY) {

    result.push(
      "🔴 Mistral — API ключ отсутствует"
    );

  } else {

    const check =
      await probeMistral(env);

    result.push(
      formatProviderStatus(
        "Mistral",
        check
      )
    );
  }


  // CLOUDFLARE

  if (env.AI) {

    try {

      const response =
        await env.AI.run(
          CLOUDFLARE_MODEL,
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

    } catch {

      result.push(
        "🔴 Cloudflare AI — ошибка"
      );
    }

  } else {

    result.push(
      "🟡 Cloudflare AI — binding AI не подключён"
    );
  }


  // OPENROUTER

  if (!env.OPENROUTER_API_KEY) {

    result.push(
      "🔴 OpenRouter — API ключ отсутствует"
    );

  } else {

    const openrouter =
      await getOpenRouterKeyInfo(env);

    if (openrouter.ok) {

      const d = openrouter.data;

      if (d.limit !== null && d.limit !== undefined) {

        result.push(
          `🟢 OpenRouter — подключён\n   💰 Осталось: $${formatNumber(d.limit_remaining)}`
        );

      } else {

        result.push(
          "🟢 OpenRouter — подключён"
        );
      }

    } else {

      result.push(
        `🔴 OpenRouter — ошибка ${openrouter.status || ""}`.trim()
      );
    }
  }


  // TAVILY

  if (!env.TAVILY_API_KEY) {

    result.push(
      "🔴 Tavily Search — API ключ отсутствует"
    );

  } else {

    const check =
      await probeTavily(env);

    result.push(
      formatProviderStatus(
        "Tavily Search",
        check
      )
    );
  }


  result.push(
    "",
    "🌐 Интернет: Tavily Search",
    "🔎 Автоматический поиск: включён",
    "📌 Принудительный поиск: /search вопрос",
    "",
    "📊 Подробные лимиты: /limit"
  );

  return result.join("\n");
}


// ======================================================
// LIMITS
// ======================================================

async function checkLimits(env) {

  const result = [
    "📊 СОФТИК — ЛИМИТЫ И API",
    ""
  ];


  // GEMINI

  if (!env.GEMINI_API_KEY) {

    result.push(
      "🔴 Gemini — ключ отсутствует"
    );

  } else {

    const check =
      await probeGemini(env);

    result.push(
      formatLimitLine(
        "Gemini 3.6 Flash",
        check
      )
    );
  }


  // GROQ

  if (!env.GROQ_API_KEY) {

    result.push(
      "🔴 Groq — ключ отсутствует"
    );

  } else {

    const check =
      await probeGroq(env);

    result.push(
      formatLimitLine(
        "Groq GPT-OSS 20B",
        check
      )
    );
  }


  // MISTRAL

  if (!env.MISTRAL_API_KEY) {

    result.push(
      "🔴 Mistral — ключ отсутствует"
    );

  } else {

    const check =
      await probeMistral(env);

    result.push(
      formatLimitLine(
        "Mistral",
        check
      )
    );
  }


  // TAVILY

  if (!env.TAVILY_API_KEY) {

    result.push(
      "🔴 Tavily — ключ отсутствует"
    );

  } else {

    const check =
      await probeTavily(env);

    result.push(
      formatLimitLine(
        "Tavily Search",
        check
      )
    );
  }


  // OPENROUTER

  if (!env.OPENROUTER_API_KEY) {

    result.push(
      "🔴 OpenRouter — ключ отсутствует"
    );

  } else {

    const info =
      await getOpenRouterKeyInfo(env);

    if (info.ok) {

      const d = info.data;

      result.push(
        "🟢 OpenRouter"
      );

      if (
        d.limit !== null &&
        d.limit !== undefined
      ) {

        result.push(
          `   💰 Лимит: $${formatNumber(d.limit)}`
        );

        result.push(
          `   💵 Осталось: $${formatNumber(d.limit_remaining)}`
        );

        result.push(
          `   📈 Использовано: $${formatNumber(d.usage)}`
        );

        result.push(
          `   🔄 Сброс: ${d.limit_reset || "не задан"}`
        );

      } else {

        result.push(
          "   💰 Лимит расходов API-ключа: не установлен"
        );

        result.push(
          "   📈 Использование: $" +
          formatNumber(d.usage)
        );
      }

    } else {

      result.push(
        `🔴 OpenRouter — не удалось получить лимит (${info.status || "ошибка"})`
      );
    }
  }


  result.push(
    "",
    "ℹ️ Важно:",
    "• Точные квоты Gemini зависят от проекта и тарифа.",
    "• Groq и Mistral возвращают актуальные rate-limit headers при API-запросах.",
    "• OpenRouter позволяет получить остаток лимита API-ключа напрямую.",
    "• Проверка /limit делает технические запросы к API и поэтому сама может расходовать лимит."
  );

  return result.join("\n");
}


// ======================================================
// GEMINI PROBE
// ======================================================

async function probeGemini(env) {

  try {

    const response =
      await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
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
                    text: "OK"
                  }
                ]
              }
            ],

            generationConfig: {
              maxOutputTokens: 2
            }
          })
        }
      );

    const data =
      await response.json();

    return {
      ok: response.ok,
      status: response.status,
      error: data?.error,
      headers: extractHeaders(response.headers, [
        "retry-after",
        "x-ratelimit-limit-requests",
        "x-ratelimit-remaining-requests",
        "x-ratelimit-reset-requests",
        "x-ratelimit-limit-tokens",
        "x-ratelimit-remaining-tokens",
        "x-ratelimit-reset-tokens"
      ])
    };

  } catch (error) {

    return {
      ok: false,
      status: 0,
      error: {
        message: error?.message || "connection error"
      },
      headers: {}
    };
  }
}


// ======================================================
// GROQ PROBE
// ======================================================

async function probeGroq(env) {

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
            model: GROQ_MODEL,

            messages: [
              {
                role: "user",
                content: "OK"
              }
            ],

            max_tokens: 2
          })
        }
      );

    const data =
      await response.json();

    return {
      ok: response.ok,
      status: response.status,
      error: data?.error,
      headers: extractHeaders(response.headers, [
        "retry-after",
        "x-ratelimit-limit-requests",
        "x-ratelimit-remaining-requests",
        "x-ratelimit-reset-requests",
        "x-ratelimit-limit-tokens",
        "x-ratelimit-remaining-tokens",
        "x-ratelimit-reset-tokens"
      ])
    };

  } catch (error) {

    return {
      ok: false,
      status: 0,
      error: {
        message: error?.message || "connection error"
      },
      headers: {}
    };
  }
}


// ======================================================
// MISTRAL PROBE
// ======================================================

async function probeMistral(env) {

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
            model: MISTRAL_MODEL,

            messages: [
              {
                role: "user",
                content: "OK"
              }
            ],

            max_tokens: 2
          })
        }
      );

    const data =
      await response.json();

    return {
      ok: response.ok,
      status: response.status,
      error: data?.error,
      headers: extractHeaders(response.headers, [
        "retry-after",
        "x-ratelimit-limit",
        "x-ratelimit-remaining",
        "x-ratelimit-reset",
        "x-ratelimit-limit-requests",
        "x-ratelimit-remaining-requests",
        "x-ratelimit-reset-requests",
        "x-ratelimit-limit-tokens",
        "x-ratelimit-remaining-tokens",
        "x-ratelimit-reset-tokens"
      ])
    };

  } catch (error) {

    return {
      ok: false,
      status: 0,
      error: {
        message: error?.message || "connection error"
      },
      headers: {}
    };
  }
}


// ======================================================
// TAVILY PROBE
// ======================================================

async function probeTavily(env) {

  try {

    const response =
      await fetch(
        "https://api.tavily.com/search",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${env.TAVILY_API_KEY}`
          },

          body: JSON.stringify({
            query: "Tavily API",
            search_depth: "basic",
            max_results: 1,
            include_answer: false,
            include_raw_content: false,
            include_images: false
          })
        }
      );

    const data =
      await response.json();

    return {
      ok: response.ok,
      status: response.status,
      error: data?.error,
      headers: extractHeaders(response.headers, [
        "retry-after",
        "x-ratelimit-limit",
        "x-ratelimit-remaining",
        "x-ratelimit-reset",
        "x-ratelimit-limit-requests",
        "x-ratelimit-remaining-requests",
        "x-ratelimit-reset-requests"
      ])
    };

  } catch (error) {

    return {
      ok: false,
      status: 0,
      error: {
        message: error?.message || "connection error"
      },
      headers: {}
    };
  }
}


// ======================================================
// OPENROUTER KEY INFO
// ======================================================

async function getOpenRouterKeyInfo(env) {

  try {

    const response =
      await fetch(
        "https://openrouter.ai/api/v1/key",
        {
          method: "GET",

          headers: {
            "Authorization":
              `Bearer ${env.OPENROUTER_API_KEY}`
          }
        }
      );

    const data =
      await response.json();

    return {
      ok: response.ok,
      status: response.status,
      data: data?.data || null
    };

  } catch {

    return {
      ok: false,
      status: 0,
      data: null
    };
  }
}


// ======================================================
// FORMAT STATUS
// ======================================================

function formatProviderStatus(name, check) {

  if (check.status === 429) {

    return `🟡 ${name} — лимит/квота исчерпана`;
  }

  if (
    check.status === 401 ||
    check.status === 403
  ) {

    return `🔴 ${name} — ошибка доступа ${check.status}`;
  }

  if (check.status === 402) {

    return `🔴 ${name} — требуется оплата/кредиты`;
  }

  if (check.status === 0) {

    return `🔴 ${name} — ошибка соединения`;
  }

  if (check.ok) {

    return `🟢 ${name} — работает`;
  }

  return `🔴 ${name} — ошибка ${check.status}`;
}


// ======================================================
// FORMAT LIMIT
// ======================================================

function formatLimitLine(name, check) {

  if (check.status === 429) {

    const retry =
      check.headers?.["retry-after"];

    return `🟡 ${name} — лимит достигнут${
      retry ? `, retry-after: ${retry}` : ""
    }`;
  }

  if (
    check.status === 401 ||
    check.status === 403
  ) {

    return `🔴 ${name} — ошибка доступа ${check.status}`;
  }

  if (check.status === 402) {

    return `🔴 ${name} — недостаточно кредитов/оплаты`;
  }

  if (check.status === 0) {

    return `🔴 ${name} — ошибка соединения`;
  }


  if (!check.ok) {

    return `🔴 ${name} — ошибка ${check.status}`;
  }


  const h =
    check.headers || {};

  const parts = [];


  if (h["x-ratelimit-remaining-requests"]) {

    parts.push(
      `запросов осталось: ${h["x-ratelimit-remaining-requests"]}`
    );
  }


  if (h["x-ratelimit-limit-requests"]) {

    parts.push(
      `лимит RPD: ${h["x-ratelimit-limit-requests"]}`
    );
  }


  if (h["x-ratelimit-remaining-tokens"]) {

    parts.push(
      `токенов осталось: ${h["x-ratelimit-remaining-tokens"]}`
    );
  }


  if (h["x-ratelimit-limit-tokens"]) {

    parts.push(
      `TPM: ${h["x-ratelimit-limit-tokens"]}`
    );
  }


  if (parts.length === 0) {

    return `🟢 ${name} — запрос проходит, точный остаток API не раскрывает`;
  }


  return `🟢 ${name}\n   ${parts.join("\n   ")}`;
}


// ======================================================
// HEADER HELPERS
// ======================================================

function extractHeaders(headers, names) {

  const result = {};

  for (const name of names) {

    const value =
      headers.get(name);

    if (value !== null) {

      result[name] = value;
    }
  }

  return result;
}


// ======================================================
// NUMBER FORMAT
// ======================================================

function formatNumber(value) {

  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return number.toFixed(2);
}


// ======================================================
// TELEGRAM
// ======================================================

async function sendTelegramMessage(
  token,
  chatId,
  text
) {

  const MAX_LENGTH = 4000;

  if (!text) {
    return;
  }

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
