// @ts-ignore Deno resolves URL imports at runtime in Supabase Edge Functions.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestPayload = {
  messages?: ChatMessage[];
  context?: unknown;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mistralApiKey = Deno.env.get("MISTRAL_API_KEY");
    if (!mistralApiKey) {
      return new Response(
        JSON.stringify({ error: "MISTRAL_API_KEY is not configured." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const payload = (await req.json()) as RequestPayload;
    const messages = Array.isArray(payload.messages) ? payload.messages : [];

    const systemPrompt = [
      "You are an inventory assistant for a small retailer.",
      "Answer with practical, concise guidance in a clean structure.",
      "Use this default response format unless the user asks otherwise:",
      "1) Quick answer: one short sentence.",
      "2) Key points: 2-5 bullet points with concrete actions or findings.",
      "3) If recommending reorder quantities, include a brief reason for each item.",
      "4) If data is missing, add a 'Missing data' bullet that names the missing fields.",
      "5) End with one short 'Next step' line.",
      "Do not use markdown tables.",
      "Keep responses scannable and under 180 words unless the user asks for detail.",
    ].join(" ");

    const contextText = `Inventory context JSON: ${JSON.stringify(payload.context ?? {}, null, 2)}`;

    const mistralBody = {
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: contextText },
        ...messages.map((msg) => ({ role: msg.role, content: msg.content })),
      ],
      temperature: 0.2,
      max_tokens: 500,
    };

    const mistralResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mistralApiKey}`,
      },
      body: JSON.stringify(mistralBody),
    });

    const mistralJson = await mistralResponse.json();

    if (!mistralResponse.ok) {
      return new Response(
        JSON.stringify({
          error: mistralJson?.error?.message ?? "Mistral API request failed.",
          details: mistralJson,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const reply = mistralJson?.choices?.[0]?.message?.content;

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
