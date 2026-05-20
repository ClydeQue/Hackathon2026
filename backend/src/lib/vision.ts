import Anthropic from "@anthropic-ai/sdk";

const ALLOWED_CATEGORIES = [
  "top",
  "bottom",
  "outerwear",
  "shoes",
  "accessory",
  "dress",
  "other",
] as const;
type Category = (typeof ALLOWED_CATEGORIES)[number];

export type VisionTags = {
  category: Category;
  color?: string;
  material?: string;
  brand?: string;
  raw?: unknown;
};

const SYSTEM_PROMPT = `You are a clothing-cataloguing assistant for the SlowFashion app.

You receive a single photo of one garment and must return a compact JSON object describing it. Output ONLY raw JSON, no commentary, no markdown fences.

Schema:
{
  "category": one of ["top","bottom","outerwear","shoes","accessory","dress","other"],
  "color": short lowercase canonical color name (e.g. "navy","cream","rust","black"). Pick the dominant color.
  "material": optional, short lowercase noun (e.g. "cotton","wool","denim","leather"). Omit if unsure.
  "brand": optional, only include if a brand logo or tag is clearly legible. Omit otherwise.
}

Rules:
- Always include "category" and "color".
- Never invent a brand. If the brand isn't clearly visible, omit the field entirely.
- "category" must match the allowed list exactly. Use "other" if nothing fits.`;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function safeParseJSON(text: string): Record<string, unknown> | null {
  // Models occasionally wrap JSON in fences despite instructions.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function normalizeCategory(value: unknown): Category {
  if (typeof value === "string") {
    const v = value.toLowerCase().trim();
    if ((ALLOWED_CATEGORIES as readonly string[]).includes(v)) return v as Category;
  }
  return "other";
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  return v.length === 0 ? undefined : v;
}

export async function classifyGarment(imageBase64: string, mediaType: string): Promise<VisionTags> {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: "Classify this garment. Respond with raw JSON only.",
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";
  const parsed = safeParseJSON(raw) ?? {};

  return {
    category: normalizeCategory(parsed.category),
    color: normalizeString(parsed.color),
    material: normalizeString(parsed.material),
    brand: normalizeString(parsed.brand),
    raw: parsed,
  };
}
