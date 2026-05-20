import { GoogleGenAI, Type } from "@google/genai";

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

You receive a single photo of one garment and must return a compact JSON object describing it.

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

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING, enum: [...ALLOWED_CATEGORIES] },
    color: { type: Type.STRING },
    material: { type: Type.STRING },
    brand: { type: Type.STRING },
  },
  required: ["category", "color"],
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: mediaType, data: imageBase64 } },
          { text: "Classify this garment." },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 256,
    },
  });

  const parsed = (JSON.parse(res.text ?? "{}") ?? {}) as Record<string, unknown>;

  return {
    category: normalizeCategory(parsed.category),
    color: normalizeString(parsed.color),
    material: normalizeString(parsed.material),
    brand: normalizeString(parsed.brand),
    raw: parsed,
  };
}
