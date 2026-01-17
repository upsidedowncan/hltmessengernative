import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { url } = req;
  const urlObj = new URL(url);
  const task = urlObj.searchParams.get("task"); // 'chat' or 'models'
  const provider = urlObj.searchParams.get("provider") || "wafer";

  let apiUrl = "";
  let apiKey: string | undefined;

  if (provider === "wafer") {
    apiUrl = "https://api.cerebras.ai/v1";
    apiKey = Deno.env.get("CEREBRAS_API_KEY");
  } else if (provider === "nebula") {
    apiUrl = "https://green-river-45f6.utoplennik69pc.workers.dev";
    apiKey = Deno.env.get("NEBULA_API_KEY");
  } else {
    return new Response(JSON.stringify({ error: "Invalid provider" }), { status: 400, headers: corsHeaders });
  }

  const headers = {
    "Content-Type": "application/json",
    ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
  };

  try {
    if (task === "models") {
      try {
        let fetchUrl = `${apiUrl}/models`;
        if (provider === "nebula") {
          fetchUrl = `${apiUrl}/v1/models`;
        }
        console.log(`Fetching models from: ${fetchUrl}`);
        const response = await fetch(fetchUrl, {
          method: "GET",
          headers,
        });

        if (!response.ok) {
           const text = await response.text();
           return new Response(JSON.stringify({ error: `Upstream error: ${response.status}`, details: text }), { 
               status: 502, 
               headers: { ...corsHeaders, "Content-Type": "application/json" } 
           });
        }

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
         return new Response(JSON.stringify({ error: "Failed to fetch models", details: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (task === "chat") {
      let body;
      try {
        body = await req.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: corsHeaders });
      }

      try {
        let fetchUrl = `${apiUrl}/chat/completions`;
        let requestBody = "";

        if (provider === "nebula") {
          fetchUrl = `${apiUrl}/`; // Nebula uses the root endpoint
          
          if ((body.prompt || body.input) && !body.messages) {
            // Direct prompt (e.g. TTS)
            requestBody = JSON.stringify(body);
          } else {
            const messages = body.messages || [];
            const systemMsg = messages.find((m: any) => m.role === 'system');
            const conversation = messages.filter((m: any) => m.role !== 'system');
            const lastMsg = conversation[conversation.length - 1];
            
            requestBody = JSON.stringify({
              prompt: lastMsg ? lastMsg.content : "",
              systemPrompt: systemMsg ? systemMsg.content : "You are a helpful assistant.",
              history: conversation.slice(0, -1).map((m: any) => ({ role: m.role, content: m.content })),
              stream: true,
              model: body.model
            });
          }
        } else {
          // Wafer / Default
          requestBody = JSON.stringify({ ...body, stream: true });
        }

        console.log(`Fetching chat from: ${fetchUrl}`);
        
        const response = await fetch(fetchUrl, {
          method: "POST",
          headers,
          body: requestBody,
        });

        if (!response.ok) {
             const text = await response.text();
             return new Response(JSON.stringify({ error: `Upstream error: ${response.status}`, details: text }), { 
                 status: response.status, 
                 headers: { ...corsHeaders, "Content-Type": "application/json" } 
             });
        }

        return new Response(response.body, {
          status: response.status,
          headers: {
            ...corsHeaders,
            "Content-Type": response.headers.get("Content-Type") || "text/event-stream",
          },
        });
      } catch (err) {
        console.error("Upstream fetch error:", err);
        return new Response(JSON.stringify({ error: "Failed to contact AI provider", details: err.message }), { status: 502, headers: corsHeaders });
      }
    }

    return new Response("Invalid task", { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
