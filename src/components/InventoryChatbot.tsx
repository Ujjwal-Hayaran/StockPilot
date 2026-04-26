import { FormEvent, useMemo, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, User, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Product = Tables<"products">;
type StockMovement = Tables<"stock_movements"> & { products?: Pick<Product, "name"> | null };

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

interface InventoryChatbotProps {
  products: Product[];
  movements: StockMovement[];
}

const starter: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I can help with low-stock checks, reorder suggestions, and quick inventory questions. Try: 'What should I reorder today?'",
};

export const InventoryChatbot = ({ products, movements }: InventoryChatbotProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([starter]);

  const context = useMemo(
    () => ({
      products: products.slice(0, 120).map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        current_stock: item.current_stock,
        price: Number(item.price),
        supplier_phone: item.supplier_phone,
      })),
      recent_movements: movements.slice(0, 50).map((item) => ({
        product_id: item.product_id,
        product_name: item.products?.name ?? "Unknown",
        movement_type: item.movement_type,
        quantity: item.quantity,
        movement_date: item.movement_date,
      })),
    }),
    [products, movements],
  );

  const handleAsk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim() || loading) return;

    const userMessage: ChatMessage = { role: "user", content: query.trim() };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setQuery("");
    setLoading(true);

    const { data, error } = await supabase.functions.invoke("ai-chat", {
      body: {
        messages: nextMessages,
        context,
      },
    });

    if (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I could not reach the AI function. Please confirm the ai-chat function is deployed and MISTRAL_API_KEY is configured.",
        },
      ]);
      setLoading(false);
      return;
    }

    const reply = typeof data?.reply === "string" && data.reply.trim().length > 0
      ? data.reply
      : "I received an empty response. Please try again.";

    setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    setLoading(false);
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-5 right-5 z-50 gap-2 rounded-full px-4 py-6 shadow-lg"
      >
        {open ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        {open ? "Close AI" : "AI Assistant"}
      </Button>

      {open && (
        <Card className="fixed bottom-24 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-md border shadow-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="h-4 w-4" />
              StockPilot AI Assistant (Mistral)
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border bg-muted/40 p-3">
              {messages.map((message, idx) => (
                <div key={`${message.role}-${idx}`} className="flex items-start gap-2 text-sm">
                  {message.role === "assistant" ? (
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-foreground" />
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking...
                </div>
              )}
            </div>

            <form onSubmit={handleAsk} className="flex items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about stock, reorder, trends..."
              />
              <Button type="submit" disabled={loading || !query.trim()} size="icon" aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );
};
