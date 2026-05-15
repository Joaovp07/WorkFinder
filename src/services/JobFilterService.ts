export interface CandidatoBase {
  nome?: string;
  email?: string;
  telefone?: string;
  experienciaTexto?: string;
  cargo?: string;
  senioridade?: string; // e.g. "Júnior", "Pleno", "Sênior", "Estágio"
}

/**
 * Serviço de filtro e refinamento de vagas (Pré-Filtro / Clean Architecture)
 * Responsável por higienizar, normalizar, filtrar e extrair dados da listagem
 * bruta de vagas antes de enviar ao Gemini (LLM).
 */
export class JobFilterService {
  /**
   * Recebe a lista bruta da API externa e o perfil do candidato.
   * Retorna uma lista limpa, sem duplicações, com tecnologias extraídas
   * e já cortada no limite máximo de segurança para a LLM.
   */
  public static refineJobs(rawJobs: any[], candidato: CandidatoBase): any[] {
    if (!rawJobs || rawJobs.length === 0) return [];

    let processados = rawJobs.map((job) => this.normalizeData(job));
    processados = this.deduplicateJobs(processados);
    processados = this.filterByGeography(processados);
    processados = this.filterBySeniority(
      processados,
      candidato.senioridade || "Junior",
    ); // Assume Junior se não estiver claro

    // Limite de Payload: Retorna no máximo as 50 melhores para não estourar o limite de tokens da LLM, dando mais opções ao Gemini.
    return processados.slice(0, 50);
  }

  /**
   * Normalização e Extração.
   */
  private static normalizeData(job: any): any {
    // Normalização: Remoto
    let modelo = job.candidate_required_location || job.job_type || job.localizacao || "";
    const modeloLower = modelo.toLowerCase();

    if (
      modeloLower.includes("remote") ||
      modeloLower.includes("work from home") ||
      modeloLower.includes("anywhere") ||
      modeloLower.includes("remoto")
    ) {
      modelo = "Remoto";
    }

    const description = job.descricao || job.description || "";

    // Extrai as stacks tecnológicas presentes usando a regex
    const extractedSkills = this.extractStack(description);

    return {
      id: job.id,
      titulo: job.titulo || job.title || "",
      empresa: job.empresa || job.company_name || "",
      modelo_trabalho: modelo,
      localizacao_original: job.localizacao || job.candidate_required_location || "",
      link_vaga: job.link_vaga || job.url || "",
      tecnologias_encontradas: extractedSkills,
      // Retira tags HTML da description para enviar um texto limpo para o Gemini
      description_summary:
        description.replace(/<[^>]*>?/gm, "").substring(0, 600) + "...",
    };
  }

  /**
   * Deduplicação: Remove duplicadas por "Título + Empresa"
   */
  private static deduplicateJobs(jobs: any[]): any[] {
    const seen = new Set<string>();
    return jobs.filter((job) => {
      const key = `${job.titulo.toLowerCase().trim()}|${job.empresa.toLowerCase().trim()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Filtro Geográfico (Crucial)
   * Descarta sumariamente vagas onde a localização exigida não contemple o Brasil.
   */
  private static filterByGeography(jobs: any[]): any[] {
    const validLocationsRegex =
      /brazil|brasil|américa latina|latin america|latam|worldwide|anywhere/i;

    return jobs
      .filter((job) => {
        // Usamos candidate_required_location para remotive ou similar, ou modelo_trabalho normalizado do mock
        const location = (
          job.localizacao_original ||
          job.modelo_trabalho ||
          ""
        ).toLowerCase();
        
        // Se a vaga for remota ou não tiver restrição explícita fora do Brasil/América Latina, nós a mantemos.
        if (job.modelo_trabalho === "Remoto") return true;

        return (
          validLocationsRegex.test(location) ||
          validLocationsRegex.test((job.titulo || "").toLowerCase()) ||
          location === "" // Aceita locações vazias
        );
      })
      .filter((job) => {
        // Refinamento extra: se explicitly diz "US Only" ou "EMEA", então rejeitamos.
        const location = (job.localizacao_original || "").toLowerCase();
        if (
          location.includes("us only") ||
          location.includes("uk only") ||
          location.includes("emea")
        ) {
          return false;
        }
        return true;
      });
  }

  /**
   * Filtro de Senioridade (Crucial)
   * Se o usuário for estagiário ou júnior, descartamos vagas puramente seniores.
   */
  private static filterBySeniority(jobs: any[], userSeniority: string): any[] {
    const isJuniorOrEstagio = /júnior|junior|estágio|estagio|trainee/i.test(
      userSeniority,
    );

    if (!isJuniorOrEstagio) {
      return jobs;
    }

    // Regex para identificar cargos seniores
    const seniorKeywords =
      /\b(senior|sênior|sr|lead|tech lead|principal|head|manager|diretor|director)\b/i;

    return jobs.filter((job) => !seniorKeywords.test(job.titulo));
  }

  /**
   * Extração de Stack Tecnológica via Expressões Regulares (Regex)
   * Explicação: Usamos "\b" (word boundary) para garantir que pegamos exatamente
   * a palavra, evitando falsos positivos (ex: "react" dentro de "interaction").
   * O "/i" no final garante busca case-insensitive (React, react, REACT).
   */
  private static extractStack(text: string): string[] {
    const techPatterns = [
      { name: "React", regex: /\breact(?:\.?js)?\b/i },
      { name: "Angular", regex: /\bangular(?:\.?js)?\b/i },
      { name: "Vue.js", regex: /\bvue(?:\.?js)?\b/i },
      { name: "Node.js", regex: /\bnode(?:\.?js)?\b/i },
      { name: "Python", regex: /\bpython\b/i },
      { name: "FastAPI", regex: /\bfastapi\b/i },
      { name: "Django", regex: /\bdjango\b/i },
      { name: "Javascript", regex: /\bjavascript|js\b/i },
      { name: "Typescript", regex: /\btypescript|ts\b/i },
      { name: "Java", regex: /\bjava\b/i },
      { name: "C#", regex: /\bc#|csharp\b/i },
      { name: "Go", regex: /\bgolang|go\b/i },
      { name: "Ruby", regex: /\bruby\b/i },
      { name: "PHP", regex: /\bphp\b/i },
      { name: "PostgreSQL", regex: /\bpostgres(?:ql)?\b/i },
      { name: "MySQL", regex: /\bmysql\b/i },
      { name: "MongoDB", regex: /\bmongo(?:db)?\b/i },
      { name: "Docker", regex: /\bdocker\b/i },
      { name: "Kubernetes", regex: /\bkubernetes|k8s\b/i },
      { name: "AWS", regex: /\baws\b/i },
    ];

    const foundSkills = new Set<string>();

    for (const tech of techPatterns) {
      if (tech.regex.test(text)) {
        foundSkills.add(tech.name);
      }
    }

    return Array.from(foundSkills);
  }
}

/**
 * EXEMPLO DE ENTRADA E SAÍDA SIMULADA (Como requerido no teste):
 *
 * --- Entrada (JSON Sujo da API Remotive) ---
 * {
 *   "id": 1234,
 *   "url": "https://remotive.com/job/1234",
 *   "title": "Backend Node.js Engineer",
 *   "company_name": "Tech Corp",
 *   "job_type": "full_time",
 *   "candidate_required_location": "Work From Home",
 *   "description": "<div>We are looking for someone with experience in Javascript, Node.js and PostgreSQL. Docker is a plus!</div>"
 * }
 *
 * --- Saída (JSON Limpo processado pelo JobFilterService) ---
 * {
 *   "id": 1234,
 *   "titulo": "Backend Node.js Engineer",
 *   "empresa": "Tech Corp",
 *   "modelo_trabalho": "Remoto",
 *   "link_vaga": "https://remotive.com/job/1234",
 *   "tecnologias_encontradas": ["Node.js", "Javascript", "PostgreSQL", "Docker"],
 *   "description_summary": "We are looking for someone with experience in Javascript, Node.js and PostgreSQL. Docker is a plus!..."
 * }
 */
