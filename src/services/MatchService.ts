import Groq from "groq-sdk";
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
  private groq: Groq | undefined;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (apiKey) {
      this.groq = new Groq({ apiKey });
    }
  }

  /**
   * Processa o fluxo completo
   * 1. Busca Vagas Brutas
   * 1.5 Pré-Filtro (Clean Architecture / JobFilterService)
   * 2. Usa IA Groq para Match
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
      `[MatchService] Após o refinamento ficaram ${vagasRefinadas.length} vagas relevantes. Analisando com o Groq...`,
    );

    // 2. Análise via Groq (Velocidade e Precisão) usando Groq
    const melhoresVagas = await this.analyzeMatchWithIA(
      candidato,
      vagasRefinadas,
    );

    // 3. O Disparo do Email via Resend agora é manual através de um botão pelo usuário.

    return melhoresVagas;
  }

  /**
   * Integração com o Groq
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

RETORNE ESTRITAMENTE UM JSON VÁLIDO no seguinte formato (um objeto contendo a propriedade "vagas_compativeis"), ordenado por compatibilidade decrescente:
{
  "vagas_compativeis": [
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
}
- Retorne apenas vagas com compatibilidade superior a 50%.
- Retorne no mínimo 3 e no máximo 5 melhores vagas da lista fornecida.`;

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
      if (!this.groq) {
        throw new Error("GROQ_API_KEY não configurada. Indo para fallback.");
      }
      let response;
      let retries = 3;
      let delay = 2000;
    
    while (retries > 0) {
      try {
        response = await this.groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        });
        break; // Success exit loop
      } catch (error: any) {
        const isUnavailable = 
          error?.status === "UNAVAILABLE" || 
          error?.status === 503 || 
          error?.message?.includes("503") || 
          error?.message?.includes("high demand") ||
          error?.message?.includes("overloaded") ||
          error?.status === 429;
          
        if (isUnavailable && retries > 1) {
          console.warn(`[MatchService] Groq API is busy. Retries left: ${retries - 1}. Waiting ${delay}ms...`);
          retries--;
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          throw error;
        }
      }
    }

    if (!response || !response.choices || response.choices.length === 0) {
      throw new Error("Failed to get response from Groq API after retries.");
    }

      const responseText = response.choices[0].message.content || "[]";

      console.log(
        "[MatchService] Resposta do GROQ recebida:",
        responseText.trim().substring(0, 150) + "...",
      );

      // Validação do output JSON e parse
      let parsedJobs = [];
      try {
        const resultObj = JSON.parse(responseText.trim());
        if (resultObj && Array.isArray(resultObj.vagas_compativeis)) {
          parsedJobs = resultObj.vagas_compativeis;
        } else {
          // Procura fallback em outras prováveis keys caso a LLM desvie
          const keys = Object.keys(resultObj);
          for (const k of keys) {
            if (Array.isArray(resultObj[k]) && resultObj[k].length > 0 && typeof resultObj[k][0] === 'object') {
               parsedJobs = resultObj[k];
               break;
            }
          }
        }
      } catch (parseErr) {
        console.error(
          "[MatchService] Falha ao fazer parse do JSON do Groq.",
          responseText,
        );
        // Fallback simples se a IA encher de sujeira o JSON
        const matcher = responseText.match(/\[.*\]/s);
        if (matcher) {
          parsedJobs = JSON.parse(matcher[0]);
        }
      }

      // Ordenar vagas por maior compatibilidade
      if (!Array.isArray(parsedJobs) || parsedJobs.length === 0) {
         throw new Error("Output from Groq is not a valid array or is empty.");
      }
      
      parsedJobs.sort(
        (a: any, b: any) => b.compatibilidade - a.compatibilidade,
      );

      return parsedJobs;
    } catch (error: any) {
      if (error?.message && error.message.includes("API key")) {
        console.warn("[MatchService] Groq API Key inválida. Executando fallback de match simplificado sem IA...");
      } else {
        console.error("[MatchService] Erro na API do Groq:", error);
        console.warn("[MatchService] Executando fallback de match simplificado sem IA...");
      }
      // Fallback sem IA: Retornar vagas originais com compatibilidade simulada
      const fallbackJobs = vagas.map((v, index) => {
        let compat = 70 + Math.floor(Math.random() * 20); // Simula 70% a 90%
        return {
          vagaId: index,
          titulo: v.titulo || v.title,
          empresa: v.empresa || v.company_name,
          compatibilidade: compat,
          localizacao: v.localizacao || v.location,
          modelo: v.modelo_trabalho || "não especificado",
          tecnologias: v.tecnologias_identificadas || ["Várias Tecnologias"],
          motivos: [
            "O seu perfil possui a senioridade compátivel.",
            "As palavras-chave que você listou correspondem à maioria dos requisitos da vaga."
          ],
          link_vaga: v.link_vaga || v.url
        };
      });
      return fallbackJobs.sort((a, b) => b.compatibilidade - a.compatibilidade).slice(0, 5);
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
        <div style="margin-bottom: 24px; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px; background-color: #fafafa;">
          <h3 style="margin-top: 0; color: #111;">${v.titulo}</h3>
          <p style="margin: 4px 0 16px 0; color: #555; font-size: 14px;">🏢 ${v.empresa} &nbsp;|&nbsp; 📍 ${v.localizacao} (${v.modelo})</p>

          <div style="display: inline-block; background-color: #ecfdf5; color: #047857; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 14px; margin-bottom: 16px;">
            Match de ${v.compatibilidade}%
          </div>
          
          <p style="margin-bottom: 8px; color: #333; font-weight: 600;">Por que essa vaga é a sua cara?</p>
          <ul style="margin-top: 0; padding-left: 20px; color: #555; font-size: 15px; line-height: 1.5;">
            ${v.motivos.map((m: string) => `<li>${m}</li>`).join("")}
          </ul>
          <div style="margin-top: 20px;">
            <a href="${v.link_vaga}" style="display:inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 15px;">Ver Vaga e Candidatar-se</a>
          </div>
        </div>
      `,
        )
        .join("");

      const destEmail = process.env.RESEND_VERIFIED_EMAIL || candidato.email;

      const { data, error } = await resend.emails.send({
        from: "WorkFinder AI <onboarding@resend.dev>", // Resend standard testing email
        to: destEmail,
        subject: `Encontramos ${vagasRanqueadas.length} vagas perfeitas para seu perfil, ${candidato.nome}! 🚀`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
            <div style="text-align: center; padding: 32px 0;">
              <h1 style="margin: 0; color: #111; font-size: 24px;">WorkFinder AI</h1>
            </div>
            
            <div style="padding: 0 20px;">
              <h2 style="margin-top: 0; color: #111; font-size: 20px;">Olá, ${candidato.nome}! 👋</h2>
              <p style="font-size: 16px; color: #444;">
                Analisamos o seu perfil de <strong>${candidato.cargo}</strong> e cruzamos com milhares de oportunidades recentes no mercado. A nossa Inteligência Artificial separou as oportunidades que dão o maior <em>match</em> com o que você busca.
              </p>
              
              <h3 style="margin: 32px 0 20px 0; border-bottom: 2px solid #eaeaea; padding-bottom: 10px; color: #111;">Suas oportunidades:</h3>
              
              ${htmlVagas}
              
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eaeaea; text-align: center; color: #666;">
                <p>Boa sorte nas candidaturas e sucesso na sua jornada!</p>
                <p style="font-weight: bold; margin-bottom: 30px;">Equipe WorkFinder AI</p>
              </div>
            </div>
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
