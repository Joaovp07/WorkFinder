import fs from "fs";
import path from "path";

/**
 * Módulo de busca e padronização de vagas
 */

// Função para extrair tecnologias da descrição e do título usando Regex
function extractTechnologies(text: string): string[] {
  if (!text) return [];
  const keywordRegex = /\b(React|Node|Node\.js|Python|TypeScript|JavaScript|AWS|SQL|Postgres|MongoDB|Docker|Java|C#|Vue|Angular|Go|Ruby|PHP)\b/gi;
  
  const matches = text.match(keywordRegex);
  if (!matches) return [];

  // Remover duplicatas e normalizar capitalização
  const uniqueTechs = Array.from(new Set(matches.map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())));
  return uniqueTechs;
}

// Inferir modelo de trabalho a partir do texto
function inferWorkModel(text: string, candidateRequiredLocation: string): string {
  const lowercaseText = text.toLowerCase();
  if (lowercaseText.includes("remote") || lowercaseText.includes("remoto") || candidateRequiredLocation?.toLowerCase().includes("remote")) {
    return "Remoto";
  } else if (lowercaseText.includes("hybrid") || lowercaseText.includes("híbrido")) {
    return "Híbrido";
  }
  return "Presencial";
}

// Função de parsing (Padronização)
function parseJob(rawJob: any) {
  const descricao = rawJob.description ? rawJob.description.replace(/<[^>]*>?/gm, "") : "";
  const textoParaAnalise = `${rawJob.title} ${descricao}`;

  return {
    titulo: rawJob.title || "Vaga Encontrada",
    empresa: rawJob.company_name || "Confidencial",
    localizacao: rawJob.candidate_required_location || "Não informada",
    modelo_trabalho: inferWorkModel(textoParaAnalise, rawJob.candidate_required_location),
    tecnologias_identificadas: extractTechnologies(textoParaAnalise),
    link_vaga: rawJob.url || "https://remotive.com"
  };
}

export async function fetchJobs(searchTerm: string = "software-dev"): Promise<any[]> {
  const searchUrl = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(searchTerm)}&limit=10`;

  try {
    console.log(`[FetchJobs] Buscando vagas reais na Remotive: ${searchUrl}`);
    const response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Processamento e padronização
    const jobs = Array.isArray(data.jobs) ? data.jobs : [];
    const standardizedJobs = jobs.map(parseJob);
    
    return standardizedJobs;

  } catch (error) {
    console.error("[FetchJobs] Falha ao buscar vagas na API. Retornando mock local de fallback.", error);
    
    try {
      // Retorna Mock JSON em caso de falha da API externa
      const filePath = path.join(process.cwd(), "vagas-mock.json");
      const mockData = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(mockData);
    } catch (mockError) {
      console.error("[FetchJobs] Falha ao ler o arquivo vagas-mock.json:", mockError);
      return [];
    }
  }
}
