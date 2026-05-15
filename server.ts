import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import pdfParse from "pdf-parse-debugging-disabled";

// Setup multer for memory storage (for resume upload)
const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Handle OPTIONS for all /api routes
  app.options("/api/*", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    res.sendStatus(200);
  });

  // 1. POST /api/usuario -> Recebe profile e currículo (fallback para salvar, ou apenas processar direto)
  // Como é protótipo, podemos juntar a análise na rota /api/analisar-vagas

  // 2. GET /api/vagas -> Busca vagas na API remotive
  app.get("/api/vagas", async (req, res) => {
    try {
      const response = await fetch("https://remotive.com/api/remote-jobs?category=software-dev");
      if (!response.ok) throw new Error("Remotive API failed");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  // 2.5 POST /api/extrair-curriculo -> Extrai perfil do currículo sem usar IA
  app.post("/api/extrair-curriculo", upload.single("curriculo"), async (req, res) => {
    try {
      console.log("File received:", req.file ? req.file.originalname : "No file");
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const data = await pdfParse(req.file.buffer);
      const text = data.text;

      // Extract basic info using regex (No AI)
      const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/;
      const emailMatch = text.match(emailRegex);
      const email = emailMatch ? emailMatch[0] : "";

      const linkedinRegex = /(?:linkedin\.com\/in\/)([a-zA-Z0-9-_]+)/i;
      const linkedinMatch = text.match(linkedinRegex);
      const linkedin = linkedinMatch ? `linkedin.com/in/${linkedinMatch[1]}` : "";

      const githubRegex = /(?:github\.com\/)([a-zA-Z0-9-_]+)/i;
      const githubMatch = text.match(githubRegex);
      const github = githubMatch ? `github.com/${githubMatch[1]}` : "";

      // Try to find a name (usually at the very top, so first non-empty line)
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let nome = lines.length > 0 ? lines[0] : "";
      
      if (nome.toLowerCase().includes("curriculum") || nome.toLowerCase().includes("currículo")) {
          nome = lines.length > 1 ? lines[1] : nome;
      }

      // Try to extract some common technologies
      const commonTechs = ["React", "Node.js", "JavaScript", "TypeScript", "Python", "Java", "C#", "PHP", "HTML", "CSS", "SQL", "PostgreSQL", "MongoDB", "AWS", "Docker", "Angular", "Vue", "Ruby"];
      const foundTechs = commonTechs.filter(tech => new RegExp("\\b" + tech.replace(".", "\\.") + "\\b", "i").test(text));

      // Try to guess required role
      let cargo = "Desenvolvedor de Software";
      if (/frontend|front-end|front end/i.test(text)) cargo = "Desenvolvedor Front-end";
      else if (/backend|back-end|back end/i.test(text)) cargo = "Desenvolvedor Back-end";
      else if (/fullstack|full-stack|full stack/i.test(text)) cargo = "Desenvolvedor Fullstack";
      else if (/data/i.test(text)) cargo = "Engenharia de Dados";
      else if (/devops/i.test(text)) cargo = "DevOps/SRE";

      // Try to guess level
      let nivel = "Júnior";
      if (/sênior|senior/i.test(text)) nivel = "Sênior";
      else if (/pleno/i.test(text)) nivel = "Pleno";
      else if (/estágio|estagiário|intern/i.test(text)) nivel = "Estágio";

      // Extrair cidade (heuristic)
      let cidade = "";
      const cidadeRegex = /(São Paulo|Rio de Janeiro|Belo Horizonte|Curitiba|Porto Alegre|Brasília|Recife|Fortaleza|Salvador)\b/i;
      const cidadeMatch = text.match(cidadeRegex);
      if (cidadeMatch) {
         cidade = cidadeMatch[0];
      }

      // Extract sections based on keywords
      let resumo = "";
      let experiencias = "";
      let formacao = "";

      let currentSection = "";
      
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        
        if (/(resumo|perfil|sobre mim|objetivo)/i.test(lowerLine) && lowerLine.length < 30) {
          currentSection = "resumo";
          continue;
        } else if (/(experiência|histórico|experiencia profissional|professional experience)/i.test(lowerLine) && lowerLine.length < 40) {
          currentSection = "experiencias";
          continue;
        } else if (/(formação|educação|acadêmica|formacao|education)/i.test(lowerLine) && lowerLine.length < 30) {
          currentSection = "formacao";
          continue;
        } else if (/(habilidades|skills|idiomas|cursos|certificações|projetos)/i.test(lowerLine) && lowerLine.length < 30) {
          currentSection = "outros";
          continue;
        }

        if (currentSection === "resumo") {
          if (resumo.length < 500) resumo += line + "\n";
        } else if (currentSection === "experiencias") {
          if (experiencias.length < 1500) experiencias += line + "\n";
        } else if (currentSection === "formacao") {
          if (formacao.length < 1000) formacao += line + "\n";
        }
      }

      if (!resumo.trim() && lines.length > 2) {
         // Se não achou uma seção clara de resumo, usa as primeiras linhas (depois do nome)
         resumo = lines.slice(1, 5).join("\n");
      }

      res.json({
        nome: nome || "",
        email: email || "",
        linkedin: linkedin,
        github: github,
        cargo: cargo,
        nivel: nivel,
        cidade: cidade,
        tecnologias: foundTechs.join(", ") || "",
        formacao: formacao.trim(),
        experiencias: experiencias.trim(),
        resumo: resumo.trim(),
      });

    } catch (error) {
      console.error('Error parsing PDF:', error);
      res.status(500).json({ error: "Failed to parse PDF: " + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // Endpoint /api/analisar-vagas removido (agora processado localmente no frontend)

  // 9. POST /api/match-vagas -> Integração Remotive + Llama 3 Groq AI
  app.post("/api/match-vagas", async (req, res) => {
    try {
      console.log("[Match Vagas] Recebido payload do frontend:", req.body);
      
      const { candidato, curriculoBase64, fileName } = req.body;
      
      if (!candidato) {
         return res.status(400).json({ error: "Dados do candidato não fornecidos." });
      }

      // Importar o novo serviço Groq + Node (Llama 3 Match)
      const { MatchService } = await import("./src/services/MatchService.ts");
      const matchService = new MatchService();

      // Executar todo o fluxo: fetch -> Llama 3 AI Match -> Nodemailer
      const finalJobs = await matchService.executeFlow(candidato);

      console.log("[Match Vagas] Processamento completo via Groq (Llama 3).");
      res.json({ jobs: finalJobs });

    } catch (error) {
      console.error("[Match Vagas] Error:", error);
      res.status(500).json({ error: "Failed to process match: " + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // Endpoint removido: webhook-proxy (agora o backend chama o make diretamente)
  
  // Endpoint removido: enviar-email (agora o backend usa o webhook do make)


  // API 404 fallback
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "API endpoint not found", path: req.path });
  });

  // API Error handling middleware
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("API Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

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
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled Server Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });
}

startServer();
