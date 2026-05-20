import "dotenv/config";
import express, { type Request, type Response } from "express";
import scanRouter from "./routes/scan";

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json({ limit: "1mb" }));

app.get("/", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "slowfashion-backend" });
});

app.use(scanRouter);

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
