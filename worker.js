export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Softik AI is working! 🤖");
    }

    try {
      const update = await request.json();

      // Telegram прислал сообщение
      if (!update.message || !update.message.text) {
        return new Response("OK");
      }

      const chatId = update.message.chat.id;
      const userMessage = update.message.text;

      // Отправляем сообщение в OpenRouter
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
            messages: [
              {
                role: "user",
                content: userMessage
              }
            ]
          })
        }
      );

      const data = await aiResponse.json();

      const answer =
        data.choices?.[0]?.message?.content ||
        "ИИ не смог сформировать ответ 😔";

      // Отправляем ответ обратно в Telegram
      await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: answer
          })
        }
      );

      return new Response("OK");

    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error.message
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
  }
};
