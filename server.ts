import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { ResumeController } from "./src/controllers/ResumeController";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Handle OPTIONS for all /api routes
  app.options("/api/*", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Accept",
    );
    res.sendStatus(200);
  });

  // 1. POST /api/usuario -> Recebe profile e currículo (fallback para salvar, ou apenas processar direto)
  // Como é protótipo, podemos juntar a análise na rota /api/analisar-vagas

  // 2. GET /api/vagas -> Busca vagas na API remotive
  app.get("/api/vagas", async (req, res) => {
    try {
      const response = await fetch(
        "https://remotive.com/api/remote-jobs?category=software-dev",
      );
      if (!response.ok) throw new Error("Remotive API failed");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  // 2.5 POST /api/extrair-curriculo -> Analisa com PDF-parse e Gemini IA
  app.post("/api/extrair-curriculo", ResumeController.analyzeResume);

  // Endpoint /api/analisar-vagas removido (agora processado localmente no frontend)

  // 9. POST /api/match-vagas -> Integração e Gemini AI Match
  app.post("/api/match-vagas", async (req, res) => {
    try {
      console.log("[Match Vagas] Recebido payload do frontend:", req.body);

      const { candidato, curriculoBase64, fileName } = req.body;

      if (!candidato) {
        return res
          .status(400)
          .json({ error: "Dados do candidato não fornecidos." });
      }

      // Importar o novo serviço (Gemini Match)
      const { MatchService } = await import("./src/services/MatchService.ts");
      const matchService = new MatchService();

      const candidatoConvertido = {
        nome: candidato.nome_completo || candidato.nome || "Candidato",
        email: candidato.email || "",
        cargo: candidato.cargo_desejado || candidato.cargo || "developer",
        nivel: candidato.nivel_profissional || candidato.nivel || "",
        tecnologias: Array.isArray(candidato.tecnologias_conhecidas) 
          ? candidato.tecnologias_conhecidas.join(", ") 
          : (candidato.tecnologias_conhecidas || candidato.tecnologias || ""),
        resumo: candidato.resumo_profissional || candidato.resumo || "",
        cidade: candidato.cidade_estado || candidato.cidade || ""
      };

      // Executar todo o fluxo: fetch -> Gemini AI Match -> Resend
      const finalJobs = await matchService.executeFlow(candidatoConvertido);

      console.log("[Match Vagas] Processamento completo via Gemini.");
      res.json({ jobs: finalJobs });
    } catch (error: any) {
      console.error("[Match Vagas] Error:", error);

      const status = error.customStatus || 500;
      const errorMessage =
        error.customStatus === 503
          ? "Não foi possível buscar novas vagas no momento. Por favor, tente novamente em alguns instantes."
          : error.message || "Failed to process match";

      res.status(status).json({ error: errorMessage });
    }
  });

  // Endpoint removido: webhook-proxy (agora o backend chama o make diretamente)

  // Endpoint removido: enviar-email (agora o backend usa o webhook do make)

  app.post("/api/enviar-email", async (req, res) => {
    try {
      const { candidato, vagas } = req.body;
      if (!candidato || !vagas) {
        return res.status(400).json({ error: "Dados incompletos" });
      }
      const { MatchService } = await import("./src/services/MatchService.ts");
      const matchService = new MatchService();
      await matchService.sendEmailViaResend(candidato, vagas);
      res.json({ success: true, message: "E-mail enviado com sucesso" });
    } catch (error: any) {
      console.error("[Enviar Email] Error:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });

  // API 404 fallback
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API endpoint not found", path: req.path });
  });

  // API Error handling middleware
  app.use(
    "/api",
    (
      err: any,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      console.error("API Error:", err);
      res.status(500).json({ error: err.message || "Internal Server Error" });
    },
  );

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Error handling middleware to prevent HTML errors
  app.use(
    (
      err: any,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      console.error("Unhandled Server Error:", err);
      res.status(500).json({ error: err.message || "Internal Server Error" });
    },
  );
}

startServer();
