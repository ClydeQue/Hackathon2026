import { Router, type Response } from "express";
import multer from "multer";
import { requireUser, type AuthedRequest } from "../middleware/auth";
import { classifyGarment } from "../lib/vision";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
});

router.post(
  "/scan",
  requireUser,
  upload.single("image"),
  async (req: AuthedRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "Missing 'image' file" });
      return;
    }
    const mediaType = req.file.mimetype || "image/jpeg";
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mediaType)) {
      res.status(415).json({ error: `Unsupported media type: ${mediaType}` });
      return;
    }
    try {
      const tags = await classifyGarment(req.file.buffer.toString("base64"), mediaType);
      res.json(tags);
    } catch (err: unknown) {
      res.status(502).json({
        error: "Vision classification failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  },
);

export default router;
