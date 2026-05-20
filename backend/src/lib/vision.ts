import { GoogleGenAI, Type } from "@google/genai";

const ALLOWED_CATEGORIES = [
  "top",
  "bottom",
  "outerwear",
  "dress",
  "other",
] as const;
type Category = (typeof ALLOWED_CATEGORIES)[number];

const ALLOWED_CONDITIONS = [
  "damaged",
  "used",
  "barely_used",
  "good",
  "brand_new",
] as const;
type Condition = (typeof ALLOWED_CONDITIONS)[number];

// Canonical color vocabulary. Pinning these keeps the database tidy — without
// the constraint we ended up with "off-white", "ivory", "bone", and "cream"
// all describing the same thing.
const ALLOWED_COLORS = [
  "black",
  "white",
  "gray",
  "beige",
  "cream",
  "brown",
  "tan",
  "navy",
  "blue",
  "teal",
  "green",
  "olive",
  "yellow",
  "mustard",
  "orange",
  "rust",
  "red",
  "burgundy",
  "pink",
  "purple",
  "multicolor",
] as const;
type ColorName = (typeof ALLOWED_COLORS)[number];

// Material vocabulary — broad fiber families, not exact compositions. "blend"
// is the catch-all when the photo can't disambiguate.
const ALLOWED_MATERIALS = [
  "cotton",
  "linen",
  "wool",
  "cashmere",
  "denim",
  "leather",
  "suede",
  "silk",
  "polyester",
  "nylon",
  "fleece",
  "knit",
  "blend",
] as const;
type Material = (typeof ALLOWED_MATERIALS)[number];

export type VisionTags = {
  category: Category;
  color?: ColorName;
  material?: Material;
  brand?: string;
  condition: Condition;
  raw?: unknown;
};

const SYSTEM_PROMPT = `You are a clothing-cataloguing assistant for the SlowFashion app.

You receive a single photo of one garment and must return a compact JSON object describing it. All string values are lowercase. Every value you emit must come from the allowed list for that field — pick the closest match if nothing fits exactly.

Allowed values:

category (required, exactly one):
  - top: shirts, t-shirts, blouses, sweaters, hoodies, tank tops
  - bottom: pants, jeans, shorts, skirts
  - outerwear: jackets, coats, blazers, vests
  - dress: dresses, jumpsuits, rompers
  - other: anything that doesn't fit above (shoes, accessories, bags, hats)

color (required, exactly one — the dominant color):
  ["black","white","gray","beige","cream","brown","tan","navy","blue","teal","green","olive","yellow","mustard","orange","rust","red","burgundy","pink","purple","multicolor"]
  Use "multicolor" only for prints/patterns where no single color dominates. For solid garments always pick the closest single color.

material (optional, exactly one — the primary fiber family):
  ["cotton","linen","wool","cashmere","denim","leather","suede","silk","polyester","nylon","fleece","knit","blend"]
  - "denim" for visible woven indigo cotton (jeans, denim jackets), regardless of true composition.
  - "knit" for visibly-knit garments (sweaters, knit tops) when you can't tell wool from synthetic.
  - "blend" when you see fabric texture but can't identify the fiber.
  - Omit entirely if the material is genuinely unclear (e.g. very low-light photo).

brand (optional, free text):
  - Only include if a brand logo, woven label, or printed wordmark is clearly legible in the photo.
  - Emit the brand exactly as written (lowercase, no punctuation), e.g. "uniqlo", "patagonia", "carhartt".
  - Never guess. If you cannot read it, omit the field entirely.

condition (required, exactly one — judge visible wear):
  - "brand_new": looks unworn, tags possibly attached, no creases or fading
  - "good": clean, minimal wear, holds shape
  - "barely_used": light signs of use but well-kept
  - "used": clear wear — fading, pilling, soft creases
  - "damaged": holes, stains, tears, broken zippers, heavy distress
  When uncertain between two tiers, pick the worse one.

Rules:
- "category", "color", and "condition" must always be present and exactly match one allowed value.
- "material" and "brand" are optional — omit rather than guess.
- Never invent a brand.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING, enum: [...ALLOWED_CATEGORIES] },
    color: { type: Type.STRING, enum: [...ALLOWED_COLORS] },
    material: { type: Type.STRING, enum: [...ALLOWED_MATERIALS] },
    brand: { type: Type.STRING },
    condition: { type: Type.STRING, enum: [...ALLOWED_CONDITIONS] },
  },
  required: ["category", "color", "condition"],
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// gemini-2.5-pro is the higher-quality vision tier — better at fine-grained
// material/color distinctions than -flash, in exchange for ~2x latency. Worth
// the trade for catalog correctness.
const MODEL = "gemini-2.5-flash";

function normalizeCategory(value: unknown): Category {
  if (typeof value === "string") {
    const v = value.toLowerCase().trim();
    if ((ALLOWED_CATEGORIES as readonly string[]).includes(v)) return v as Category;
  }
  return "other";
}

function normalizeCondition(value: unknown): Condition {
  if (typeof value === "string") {
    const v = value.toLowerCase().trim().replace(/\s+|-/g, "_");
    if ((ALLOWED_CONDITIONS as readonly string[]).includes(v)) return v as Condition;
  }
  return "good";
}

function normalizeColor(value: unknown): ColorName | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  if ((ALLOWED_COLORS as readonly string[]).includes(v)) return v as ColorName;
  return undefined;
}

function normalizeMaterial(value: unknown): Material | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  if ((ALLOWED_MATERIALS as readonly string[]).includes(v)) return v as Material;
  return undefined;
}

function normalizeBrand(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase();
  return v.length === 0 ? undefined : v;
}

async function generateWithRetry(imageBase64: string, mediaType: string) {
  // Retry transient capacity errors (503 UNAVAILABLE, 429 RESOURCE_EXHAUSTED).
  const delaysMs = [500, 1500, 3500];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await ai.models.generateContent({
        model: MODEL,
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
          // gemini-2.5-flash has dynamic thinking on by default. With a tight
          // structured-output schema it sometimes leaks the thought trace into
          // the response (e.g. "Here is the classification…") instead of pure
          // JSON. Forcing budget=0 keeps output schema-compliant.
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 256,
        },
      });
    } catch (err: unknown) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      const isTransient = status === 503 || status === 429;
      if (!isTransient || attempt === delaysMs.length) throw err;
      await new Promise((r) => setTimeout(r, delaysMs[attempt]));
    }
  }
  throw lastErr;
}

// Pull the first balanced {...} block out of a model response. Gemini's
// structured-output mode is normally pure JSON, but it occasionally prepends
// a conversational preamble ("Here is the classification: { ... }"); this
// extractor recovers in that case instead of throwing on the leading text.
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export async function classifyGarment(imageBase64: string, mediaType: string): Promise<VisionTags> {
  const res = await generateWithRetry(imageBase64, mediaType);

  const raw = res.text ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = (JSON.parse(raw) ?? {}) as Record<string, unknown>;
  } catch {
    const block = extractJsonObject(raw);
    if (!block) {
      throw new Error(
        `Model returned non-JSON output: ${raw.slice(0, 120)}${raw.length > 120 ? "…" : ""}`,
      );
    }
    parsed = (JSON.parse(block) ?? {}) as Record<string, unknown>;
  }

  return {
    category: normalizeCategory(parsed.category),
    color: normalizeColor(parsed.color),
    material: normalizeMaterial(parsed.material),
    brand: normalizeBrand(parsed.brand),
    condition: normalizeCondition(parsed.condition),
    raw: parsed,
  };
}
