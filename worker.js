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

Если информации недостаточно для точного ответа, объясни, чего именно не хватает, и предложи способ это проверить.

Не выдумывай ответ только ради того, чтобы выглядеть уверенной.

СТИЛЬ

Используй естественную разговорную речь.

Не используй канцелярит.

Не перегружай простые ответы.

Сложные вопросы разбивай на понятные части.

Ты добрая и милая, но не бездумно согласная.

Ты можешь шутить, спорить, исправлять, объяснять, поддерживать и помогать принимать решения.

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

      // ==========================================
      // /clear — очищает ТОЛЬКО историю разговора
      // ==========================================

      if (userMessage === "/clear") {
        await env.SOFTIK_MEMORY.delete(`chat_${chatId}`);

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "Готово 🧹 Историю нашего текущего диалога я очистила. Важные вещи, которые я запомнила о тебе, остались 💗"
        );

        return new Response("OK");
      }

      // ==========================================
      // /memory — показывает долгосрочную память
      // ==========================================

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

      // ==========================================
      // /forget — полностью очищает долгосрочную память
      // ==========================================

      if (userMessage === "/forget") {
        await env.SOFTIK_MEMORY.delete(`memory_${chatId}`);

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "Готово 🧹 Я забыла сохранённые факты о тебе."
        );

        return new Response("OK");
      }

      // ==========================================
      // Получаем историю текущего разговора
      // ==========================================

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

      // ==========================================
      // Получаем долгосрочную память
      // ==========================================

      const memories = await getMemories(env, chatId);

      let memoryContext = "";

      if (memories.length > 0) {
        memoryContext = `
ДОЛГОСРОЧНАЯ ПАМЯТЬ О ПОЛЬЗОВАТЕЛЕ

Ниже находятся факты, которые были сохранены из предыдущих разговоров.

${memories.map((memory) => `- ${memory}`).join("\n")}

Используй эти сведения только тогда, когда они действительно относятся к разговору.
`;
      }

      // ==========================================
      // Запрос к OpenRouter
      // ==========================================

      const messages = [
        {
          role: "system",
          content: SYSTEM_PROMPT + memoryContext
        },
        ...history,
        {
          role: "user",
          content: userMessage
        }
      ];

      const aiResponse = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://softikaibot.fv4prnpg42.workers.dev",
            "X-Title": "Softik AI Bot"
          },
          body: JSON.stringify({
            model: "openrouter/free",
            messages
          })
        }
      );

      const data = await aiResponse.json();

      if (!aiResponse.ok) {
        console.error("OpenRouter error:", data);

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "У меня сейчас не получилось получить ответ от ИИ 😔 Попробуй ещё раз через несколько секунд."
        );

        return new Response("OK");
      }

      const answer =
        data.choices?.[0]?.message?.content ||
        "Я не смогла сформировать ответ 😔";

      // ==========================================
      // Сохраняем историю разговора
      // ==========================================

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

      // ==========================================
      // Определяем, нужно ли что-то запомнить
      // ==========================================

      const memoryInstruction = `
Ты отвечаешь за долгосрочную память AI-помощника.

Проанализируй последнее сообщение пользователя.

Нужно сохранить только действительно полезные сведения, которые могут пригодиться в будущих разговорах.

Примеры того, что МОЖНО сохранять:
- любимые вещи;
- устойчивые предпочтения;
- важные цели;
- интересы;
- важные сведения о жизни пользователя;
- долгосрочные планы;
- особенности общения, которые пользователь явно предпочитает;
- информацию, которую пользователь прямо просит запомнить.

Не сохраняй:
- случайные события сегодняшнего дня;
- временные обстоятельства;
- одноразовые действия;
- обычные вопросы;
- содержание текущей беседы, если оно не имеет долгосрочной ценности;
- секреты, пароли, токены, API-ключи или другую чувствительную информацию.

Верни ТОЛЬКО JSON-массив строк.

Если сохранять нечего:
[]

Если есть что сохранить:
["факт 1", "факт 2"]

Текущая долгосрочная память:
${memories.length > 0 ? memories.join("\n") : "пусто"}

Сообщение пользователя:
${userMessage}
`;

      try {
        const memoryResponse = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
              "HTTP-Referer": "https://softikaibot.fv4prnpg42.workers.dev",
              "X-Title": "Softik AI Memory"
            },
            body: JSON.stringify({
              model: "openrouter/free",
              messages: [
                {
                  role: "system",
                  content: memoryInstruction
                }
              ]
            })
          }
        );

        const memoryData = await memoryResponse.json();

        const memoryAnswer =
          memoryData.choices?.[0]?.message?.content || "[]";

        const cleanedMemory = memoryAnswer
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        const newMemories = JSON.parse(cleanedMemory);

        if (Array.isArray(newMemories)) {
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

          if (updatedMemories.length > MAX_MEMORIES) {
            updatedMemories =
              updatedMemories.slice(-MAX_MEMORIES);
          }

          await env.SOFTIK_MEMORY.put(
            `memory_${chatId}`,
            JSON.stringify(updatedMemories)
          );
        }
      } catch (memoryError) {
        // Ошибка памяти НЕ должна ломать основной ответ бота
        console.error(
          "Memory error:",
          memoryError
        );
      }

      // ==========================================
      // Отправляем ответ пользователю
      // ==========================================

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


// ==========================================
// Получение долгосрочной памяти
// ==========================================

async function getMemories(env, chatId) {
  const savedMemory = await env.SOFTIK_MEMORY.get(
    `memory_${chatId}`
  );

  if (!savedMemory) {
    return [];
  }

  try {
    const memories = JSON.parse(savedMemory);

    return Array.isArray(memories)
      ? memories
      : [];
  } catch {
    return [];
  }
}


// ==========================================
// Отправка сообщения в Telegram
// ==========================================

async function sendTelegramMessage(
  token,
  chatId,
  text
) {
  await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    }
  );
}
