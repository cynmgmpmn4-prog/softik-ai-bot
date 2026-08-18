export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Softik AI is working! 🤖");
    }

    try {
      const body = await request.json();
      const userMessage = body.message || "Привет";

      const response = await fetch(
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

      const data = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify(data),
          {
            status: response.status,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      }

      const answer =
        data.choices?.[0]?.message?.content ||
        "ИИ не смог сформировать ответ 😔";

      return new Response(
        JSON.stringify({
          answer: answer
        }),
        {
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

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

