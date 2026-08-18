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
`;

const MAX_MESSAGES = 20;

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

      // Очистка памяти
      if (userMessage === "/clear") {
        await env.SOFTIK_MEMORY.delete(chatId);

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "Готово 🧹 Я очистила историю нашего диалога."
        );

        return new Response("OK");
      }

      // Получаем историю пользователя
      let history = [];

      const savedHistory = await env.SOFTIK_MEMORY.get(chatId);

      if (savedHistory) {
        try {
          history = JSON.parse(savedHistory);
        } catch {
          history = [];
        }
      }

      // Формируем сообщения для OpenRouter
      const messages = [
        {
          role: "system",
          content: SYSTEM_PROMPT
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

      // Сохраняем новую пару сообщений
      history.push({
        role: "user",
        content: userMessage
      });

      history.push({
        role: "assistant",
        content: answer
      });

      // Ограничиваем историю последними сообщениями
      if (history.length > MAX_MESSAGES) {
        history = history.slice(-MAX_MESSAGES);
      }

      await env.SOFTIK_MEMORY.put(
        chatId,
        JSON.stringify(history)
      );

      // Отправляем ответ в Telegram
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

async function sendTelegramMessage(token, chatId, text) {
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
