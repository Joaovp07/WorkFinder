import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";
import pdfParse from "pdf-parse";

// Setup multer for memory storage (for resume upload)
const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json());

  // Use Gemini API
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

      // Try to find a name (usually at the very top, so first non-empty line)
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let nome = lines.length > 0 ? lines[0] : "";
      
      // se a primeira for 'curriculum vitae' pegar a segunda
      if (nome.toLowerCase().includes("curriculum") || nome.toLowerCase().includes("currículo")) {
          nome = lines.length > 1 ? lines[1] : nome;
      }

      // Try to extract some common technologies
      const commonTechs = ["React", "Node.js", "JavaScript", "TypeScript", "Python", "Java", "C#", "PHP", "HTML", "CSS", "SQL", "PostgreSQL", "MongoDB", "AWS", "Docker", "Angular", "Vue", "Ruby"];
      const foundTechs = commonTechs.filter(tech => new RegExp("\\\\b" + tech.replace(".", "\\\\.") + "\\\\b", "i").test(text));

      // Try to guess required role
      let cargo = "Desenvolvedor de Software";
      if (/frontend|front-end|front end/i.test(text)) cargo = "Desenvolvedor Front-end";
      else if (/backend|back-end|back end/i.test(text)) cargo = "Desenvolvedor Back-end";
      else if (/fullstack|full-stack|full stack/i.test(text)) cargo = "Desenvolvedor Fullstack";

      // Try to guess level
      let nivel = "Júnior";
      if (/sênior|senior/i.test(text)) nivel = "Sênior";
      else if (/pleno/i.test(text)) nivel = "Pleno";
      else if (/estágio|estagiário|intern/i.test(text)) nivel = "Estágio";

      res.json({
        nome: nome || "",
        email: email || "",
        cargo: cargo,
        nivel: nivel,
        tecnologias: foundTechs.join(", ") || "",
        resumo: "Resumo extraído automaticamente do currículo.",
      });

    } catch (error) {
      console.error('Error parsing PDF:', error);
      res.status(500).json({ error: "Failed to parse PDF: " + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // 3. POST /api/analisar-vagas -> Analisa perfil vs vagas usando Gemini
  app.post("/api/analisar-vagas", upload.single("curriculo"), async (req, res) => {
    try {
      const profileData = JSON.parse(req.body.profile);
      const limit = parseInt(req.body.limit || "20"); // limit jobs to analyze to save time/tokens
      
      // Fetch jobs from Remotive
      let jobs = [];
      try {
        // limit fetching category
        const response = await fetch("https://remotive.com/api/remote-jobs?category=software-dev&limit=50");
        const data = await response.json();
        jobs = data.jobs.slice(0, limit); // slice to avoid huge payload
      } catch (err) {
        // Fallback local jobs if API fails
        jobs = [
          {
            id: 1,
            title: "Desenvolvedor Front-end Júnior",
            company_name: "Tech Solutions",
            candidate_required_location: "Remote",
            job_type: "full_time",
            description: "Conhecimento em React, JavaScript, HTML, CSS."
          },
          {
            id: 2,
            title: "Desenvolvedor Back-end",
            company_name: "Code Corp",
            candidate_required_location: "Remote",
            job_type: "full_time",
            description: "Experiência com Node.js, Express e PostgreSQL."
          }
        ];
      }

      // Process PDF if it exists
      let curriculoText = "";
      let pdfPart = null;
      
      if (req.file) {
        // We'll send the PDF as inlineData to Gemini 1.5
        pdfPart = {
          inlineData: {
            data: req.file.buffer.toString("base64"),
            mimeType: req.file.mimetype,
          },
        };
      }

      // Create a prompt for Gemini
      const prompt = `
Você é um recrutador especialista em TI. Avalie a compatibilidade entre o perfil do candidato e a lista de vagas.

Perfil do Candidato:
Nome: ${profileData.nome}
Cargo Desejado: ${profileData.cargo}
Nível: ${profileData.nivel}
Preferência de trabalho: ${profileData.modalidade}
Tecnologias: ${profileData.tecnologias}
Resumo: ${profileData.resumo}
${pdfPart ? "O currículo em PDF do candidato também foi anexado à chamada." : ""}

Lista de Vagas:
${jobs.map((j: any) => `ID: ${j.id} | Título: ${j.title} | Empresa: ${j.company_name} | Requisito: ${j.description.substring(0, 300)}...`).join("\n\n")}

Sua tarefa:
Analise o perfil do candidato (e o pdf, se existir) contra cada vaga e retorne APENAS um JSON array.
Cada objeto do array deve seguir extritamente este formato:
{
  "vagaId": (numero id da vaga),
  "titulo": "(titulo da vaga)",
  "empresa": "(empresa)",
  "compatibilidade": (numero de 0 a 100),
  "tecnologias": [(array de strings com tecnologias identificadas na vaga)],
  "modelo": "(remoto, hibrido, ou presencial - inferido pela vaga)",
  "motivos": [(array com 3 a 4 strings explicando motivos da recomendação ou falhas)],
  "link": "(url da vaga ou vazio)"
}

Regra de pontuação (100 pontos):
- Tecnologias em comum: até 45 pts
- Nível profissional compatível: até 20 pts
- Modelo de trabalho compatível: até 15 pts
- Cargo semelhante: até 10 pts
- Localização/Outros: até 10 pts

Retorne APENAS o array JSON, começando com [ e terminando com ]. Sem formatação markdown de blocos de codigo.
Vagas com melhor compatibilidade (acima de 50) devem vir primeiro. Retorne no máximo as 5 melhores vagas.
`;
      
      let contents: any[] = [{ text: prompt }];
      if (pdfPart) {
        contents.unshift(pdfPart);
      }

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: contents,
      });

      let responseText = response.text || "[]";
      // Sanitize JSON
      responseText = responseText.replace(/^```json\n/, "").replace(/\n```$/, "").trim();
      if(!responseText.startsWith("[")) {
         responseText = responseText.substring(responseText.indexOf("["));
      }
      if(!responseText.endsWith("]")) {
        responseText = responseText.substring(0, responseText.lastIndexOf("]") + 1);
      }

      const analyisResult = JSON.parse(responseText);

      // Map back links from original jobs if we have them
      const finalResult = analyisResult.map((resJob: any) => {
        const originalJob = jobs.find((j: any) => j.id.toString() === resJob.vagaId?.toString());
        return {
          ...resJob,
          link: originalJob?.url || originalJob?.link || resJob.link || "#",
          localizacao: originalJob?.candidate_required_location || "Não especificado"
        };
      }).sort((a: any, b: any) => b.compatibilidade - a.compatibilidade);

      res.json(finalResult);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to analyze jobs" });
    }
  });

  // 4. POST /api/enviar-email -> Envia email simulado (Nodemailer)
  app.post("/api/enviar-email", async (req, res) => {
    try {
      const { email, nome, vagas } = req.body;

      // Create a test account or use realistic settings
      // For this prototype, we'll use ethereal.email to simulate and print console
      const testAccount = await nodemailer.createTestAccount();

      const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      let htmlVagas = vagas.map((v: any) => `
        <div style="margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
          <h3>${v.titulo} na ${v.empresa}</h3>
          <p><strong>Compatibilidade:</strong> <span style="color: green;">${v.compatibilidade}%</span></p>
          <p><strong>Motivos:</strong></p>
          <ul>
            ${v.motivos.map((m: string) => `<li>${m}</li>`).join('')}
          </ul>
          <a href="${v.link}" style="display:inline-block; padding:10px 15px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Candidatar-se</a>
        </div>
      `).join("");

      const mailOptions = {
        from: '"WorkFinder" <noreply@workfinder.com>',
        to: email,
        subject: `Aqui estão suas melhores vagas, ${nome}!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
            <h2>Olá, ${nome}! 👋</h2>
            <p>Analisamos seu currículo e perfil e encontramos ótimas oportunidades para você!</p>
            <hr />
            ${htmlVagas}
            <br />
            <p>Boa sorte nas candidaturas!</p>
            <p><strong>Equipe WorkFinder</strong></p>
          </div>
        `,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("E-mail simulado enviado com sucesso! URL:", nodemailer.getTestMessageUrl(info));

      res.json({ success: true, previewUrl: nodemailer.getTestMessageUrl(info) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to send email" });
    }
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
}

startServer();
