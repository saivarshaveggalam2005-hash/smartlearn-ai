/**
 * Gemini API client — the only module that calls Google Generative Language API.
 * Used exclusively for intelligent content generation (notes, tutor, revision, etc.).
 */

const GEMINI_UNAVAILABLE =
  "AI-generated content is temporarily unavailable. You can continue studying using the extracted syllabus content.";

/** Models tried in order when the primary model fails (429 quota, 404, 503). */
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
] as const;

export function isGeminiConfigured(): boolean {
  return (
    process.env.AI_PROVIDER?.toLowerCase() === "gemini" &&
    Boolean(process.env.GEMINI_API_KEY?.trim())
  );
}

function getPrimaryModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
}

function getModelChain(): string[] {
  const primary = getPrimaryModel();
  const rest = MODEL_FALLBACK_CHAIN.filter((m) => m !== primary);
  return [primary, ...rest];
}

async function callGeminiModel(
  model: string,
  prompt: string,
  apiKey: string
): Promise<{ text: string | null; status: number; error?: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      }),
      signal: AbortSignal.timeout(45000),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      message = parsed.error?.message ?? message;
    } catch {
      /* use raw body */
    }
    console.error(`[Gemini] ${model} error ${res.status}:`, message.slice(0, 200));
    return { text: null, status: res.status, error: message };
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  return { text, status: res.status };
}

/** Retry on quota (429), not found (404), and overload (503). */
function shouldTryNextModel(status: number): boolean {
  return status === 429 || status === 404 || status === 503;
}

export async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const models = getModelChain();

  for (const model of models) {
    try {
      const result = await callGeminiModel(model, prompt, apiKey);
      if (result.text) {
        if (model !== models[0]) {
          console.info(`[Gemini] Succeeded with fallback model: ${model}`);
        }
        return result.text;
      }
      if (!shouldTryNextModel(result.status)) {
        break;
      }
    } catch (err) {
      console.error(`[Gemini] ${model} request failed:`, err);
    }
  }

  return null;
}

export { GEMINI_UNAVAILABLE };
