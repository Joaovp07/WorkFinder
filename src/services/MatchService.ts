import { GoogleGenAI } from "@google/genai";
import { Resend } from "resend";
import { SerpApiService, VagaPadronizada } from "./SerpApiService";
import { JobFilterService } from "./JobFilterService";

/**
 * Interface do perfil do candidato
 */
interface Candidato {
  nome: string;
  email: string;
  cargo: string;
  nivel: string;
  tecnologias: string;
  resumo: string;
  cidade: string;
}

/**
 * Interface da Vaga retornada pela Remotive
 */
interface Vaga {
  titulo: string;
  empresa: string;
  localizacao: string;
  modelo_trabalho: string;
  tecnologias_identificadas: string[];
  link_vaga: string;
}

/**
 * Sistema principal de busca, match e notificação
 */
export class MatchService {
  private gemini: GoogleGenAI;

  constructor() {
    const apiKey = "AIzaSyB5zZq2d_4AgYbnt76TcBOiLkiVSp39c7A" || process.env["GEMINI_API_KEY-1"] || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não configurada.");
    }
    this.gemini = new GoogleGenAI({ apiKey: apiKey });
  }

  /**
   * Processa o fluxo completo
   * 1. Busca Vagas Brutas
   * 1.5 Pré-Filtro (Clean Architecture / JobFilterService)
   * 2. Usa IA Gemini para Match
   * 3. Dispara E-mail
   */
  public async executeFlow(candidato: Candidato) {
    console.log(
      `[MatchService] Iniciando fluxo para o candidato: ${candidato.nome} (${candidato.cargo})`,
    );

    // 1. Busca as vagas (via SerpApi / Google Jobs) com Degradação Graciosa
    const searchTerm = candidato.cargo || "developer";
    const searchLevel = candidato.nivel || "";
    const techSearch = candidato.tecnologias || "";
    const vagasBrutas: VagaPadronizada[] = await SerpApiService.buscarVagas(
      searchTerm,
      searchLevel,
      techSearch
    );

    if (vagasBrutas.length === 0) {
      console.warn("[MatchService] Nenhuma vaga encontrada.");
      return [];
    }

    console.log(
      `[MatchService] Foram capturadas ${vagasBrutas.length} vagas brutas.`,
    );

    // 1.5 Pré-Filtro (Clean Architecture Layer)
    const vagasRefinadas = JobFilterService.refineJobs(vagasBrutas, {
      senioridade: candidato.nivel || "Junior",
    });

    console.log(
      `[MatchService] Após o refinamento ficaram ${vagasRefinadas.length} vagas relevantes. Analisando com o Gemini...`,
    );

    // 2. Análise via Gemini (Velocidade e Precisão) usando Gemini
    const melhoresVagas = await this.analyzeMatchWithIA(
      candidato,
      vagasRefinadas,
    );

    // 3. O Disparo do Email via Resend agora é manual através de um botão pelo usuário.

    return melhoresVagas;
  }

  /**
   * Integração com o Gemini através do GoogleGenAI
   */
  private async analyzeMatchWithIA(candidato: Candidato, vagas: any[]) {
    // Prompt de Sistema extremamente rigoroso para retornar um JSON puro Validável.
    const systemPrompt = `Você é um avaliador de carreiras Sênior Especialista em recrutamento tech atuando estritamente como uma API de retorno de dados.
Sua única função é avaliar minuciosamente o perfil do CANDIDATO contra a lista de VAGAS recebidas e ranqueá-las com um score de 0 a 100 de compatibilidade.
O Score DEVE ser rigorosamente calculado com a seguinte base:
- Tecnologias e Experiência (Stack): 50 pontos (cruze a stack da vaga com as tecnologias que o candidato domina e a descrição de sua experiência. Experiência similar pesa muito).
- Nível da Vaga (Senioridade - Junior/Pleno/Senior/Estágio): 20 pontos (não indique vagas de nível pl/sr para estágio ou junior).
- Modalidade de Trabalho (Remoto/Híbrido/Presencial vs Preferência): 15 pontos.
- Adição Semântica: 15 pontos (o quanto as atividades da vaga combinam com o resumo/bio e cargos desejados do candidato).

RETORNE ESTRITAMENTE UM JSON VÁLIDO no seguinte formato (uma array de objetos), ordenado por compatibilidade decrescente:
[
  {
    "vagaId": "indicar o index do array da vaga ou ID original",
    "titulo": "titulo da vaga original",
    "empresa": "nome da empresa",
    "compatibilidade": 95,
    "localizacao": "localizacao ou Remoto",
    "modelo": "remoto",
    "tecnologias": ["React", "Node"],
    "motivos": ["Explicação clara do motivo do match baseada no resumo do candidato", "Destaque de tecnologia compatível"],
    "link_vaga": "url_da_vaga"
  }
]
- Não retorne NENHUMA quebra de bloco de código (\`\`\`json ou \`\`\`).
- Apenas a reposta iniciando com [ e terminando com ].
- Retorne apenas vagas com compatibilidade superior a 50%.
- Retorne no máximo 15 melhores vagas da lista fornecida.`;

    // Criando a mensagem de User dinamicamente com os dados serializados
    const userPrompt = `
      CANDIDATO:
      ${JSON.stringify(
        {
          nome: candidato.nome,
          cargo: candidato.cargo,
          nivel: candidato.nivel,
          tecnologias: candidato.tecnologias,
          resumo: candidato.resumo,
        },
        null,
        2,
      )}
      
      VAGAS_CAPTURADAS:
      ${JSON.stringify(
        vagas.map((v, index) => ({ id: index, ...v })),
        null,
        2,
      )}
    `;

    try {
      let response;
      let retries = 3;
      let delay = 2000;
    
    while (retries > 0) {
      try {
        response = await this.gemini.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction: {
              role: "system",
              parts: [{ text: systemPrompt }],
            },
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        });
        break; // Success exit loop
      } catch (error: any) {
        const isUnavailable = 
          error?.status === "UNAVAILABLE" || 
          error?.status === 503 || 
          error?.message?.includes("503") || 
          error?.message?.includes("high demand") ||
          error?.message?.includes("overloaded");
          
        if (isUnavailable && retries > 1) {
          console.warn(`[MatchService] Gemini API is busy. Retries left: ${retries - 1}. Waiting ${delay}ms...`);
          retries--;
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          throw error;
        }
      }
    }

    if (!response) {
      throw new Error("Failed to get response from Gemini API after retries.");
    }

      const responseText = response.text || "[]";

      console.log(
        "[MatchService] Resposta do GEMINI recebida:",
        responseText.trim().substring(0, 150) + "...",
      );

      // Validação do output JSON e parse
      let parsedJobs = [];
      try {
        parsedJobs = JSON.parse(responseText.trim());
      } catch (parseErr) {
        console.error(
          "[MatchService] Falha ao fazer parse do JSON do Gemini.",
          responseText,
        );
        // Fallback simples se a IA encher de sujeira o JSON
        const matcher = responseText.match(/\[.*\]/s);
        if (matcher) {
          parsedJobs = JSON.parse(matcher[0]);
        }
      }

      // Ordenar vagas por maior compatibilidade
      parsedJobs.sort(
        (a: any, b: any) => b.compatibilidade - a.compatibilidade,
      );

      return parsedJobs;
    } catch (error: any) {
      console.error("[MatchService] Erro na API do Gemini:", error);
      if (error.message && error.message.includes("API key not valid")) {
        throw new Error("A chave de API configurada no projeto (GEMINI_API_KEY) é inválida. Por favor, remova a chave das configurações ou adicione uma chave válida.");
      }
      throw error;
    }
  }

  /**
   * Módulo de Serviço de E-mail via Resend
   */
  public async sendEmailViaResend(
    candidato: Candidato,
    vagasRanqueadas: any[],
  ) {
    try {
      const resendApiKey = process.env.RESEND_API_KEY;

      if (!resendApiKey) {
        console.warn(
          "[MatchService] RESEND_API_KEY não configurada. O e-mail não será enviado.",
        );
        return;
      }

      console.log(
        `[MatchService] Enviando e-mail via Resend para ${candidato.email}...`,
      );
      const resend = new Resend(resendApiKey);

      let htmlVagas = vagasRanqueadas
        .map(
          (v: any) => `
        <div style="margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
          <h3>${v.titulo} na ${v.empresa}</h3>
          <p><strong>Compatibilidade:</strong> <span style="color: green;">${v.compatibilidade}%</span></p>
          <p><strong>Por que escolhemos esta vaga?</strong></p>
          <ul>
            ${v.motivos.map((m: string) => `<li>${m}</li>`).join("")}
          </ul>
          <a href="${v.link_vaga}" style="display:inline-block; padding:10px 15px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Candidatar-se</a>
        </div>
      `,
        )
        .join("");

      const destEmail = process.env.RESEND_VERIFIED_EMAIL || candidato.email;

      const { data, error } = await resend.emails.send({
        from: "WorkFinder AI <onboarding@resend.dev>", // Resend standard testing email
        to: destEmail,
        subject: `✅ Encontramos vagas ideais para você, ${candidato.nome}!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
            <h2>Olá, ${candidato.nome}! 👋</h2>
            <p>O nosso motor de IA ranqueou ${vagasRanqueadas.length} vagas perfeitas de acordo com o seu perfil!</p>
            <hr />
            ${htmlVagas}
            <br />
            <p>Boa sorte nas candidaturas!</p>
            <p><strong>Equipe WorkFinder AI</strong></p>
          </div>
        `,
      });

      if (error) {
        if (error.name === "validation_error") {
          console.info(
            "[MatchService] E-mail simulado com sucesso! (Nota: O Resend no modo gratuito bloqueou o envio real pois o e-mail do destinatário não está verificado na sua conta. Configure RESEND_VERIFIED_EMAIL no .env para testar o envio real.)",
          );
        } else {
          console.error(`[MatchService] Erro da API do Resend:`, error);
        }
      } else {
        console.log(
          "[MatchService] E-mail enviado com sucesso via Resend! ID:",
          data?.id,
        );
      }
    } catch (err) {
      console.error(
        "[MatchService] Erro inesperado ao tentar enviar e-mail pelo Resend:",
        err,
      );
    }
  }
}
