import axios from "axios";

/**
 * Interface padronizada para as vagas que o nosso sistema aceita.
 */
export interface VagaPadronizada {
  id?: string;
  titulo: string;
  empresa: string;
  localizacao: string;
  modelo_trabalho?: string;
  link_vaga: string;
  descricao: string;
}

export class SerpApiService {
  private static readonly API_URL = "https://serpapi.com/search";

  /**
   * Busca oportunidades de emprego via Google Jobs usando SerpApi
   * Implementa o padrão de "Degradação Graciosa" (Retry Pattern)
   *
   * @param cargo Cargo desejado pelo candidato
   * @param nivel Nível de senioridade (opcional)
   * @returns Array de vagas padronizadas
   */
  public static async buscarVagas(
    cargo: string,
    nivel: string = "",
    tecnologias: string = "",
  ): Promise<VagaPadronizada[]> {
    const apiKey = process.env.SERPAPI_API_KEY;

    if (!apiKey) {
      console.warn("[SerpApiService] SERPAPI_API_KEY não configurada. Usando vagas em fallback (mock).");
      return [
        {
          titulo: "Desenvolvedor Backend Node.js (Mock)",
          empresa: "Tech Corp Brasil",
          localizacao: "São Paulo, SP (Remoto)",
          modelo_trabalho: "Remoto",
          link_vaga: "https://google.com",
          descricao: "Vaga mockada devido a falta de API_KEY da SerpApi. Exigimos Node, React e AWS."
        },
        {
          titulo: "Engenheiro Frontend React Pleno (Mock)",
          empresa: "Startup Innovate",
          localizacao: "Remoto",
          modelo_trabalho: "Remoto",
          link_vaga: "https://google.com",
          descricao: "Vaga simulada de Frontend utilizando React e Tailwind"
        }
      ];
    }

    // Pega as 3 primeiras tecnologias para não deixar a query muito longa
    const prinicipaisTecnologias = tecnologias.split(',').map(t => t.trim()).filter(Boolean).slice(0, 3).join(" ");

    // Pipeline de Tentativas (Retry Pattern para degradação graciosa da busca)
    const attempts = [
      {
        step: 1,
        query: `${cargo} ${nivel} ${prinicipaisTecnologias} Brasil`.trim(),
      },
      {
        step: 2,
        query: `${cargo} ${nivel} Brasil`.trim(),
      },
      {
        step: 3,
        query: `${cargo} Brasil`.trim(),
      },
    ];

    let currentAttempt = 0;

    while (currentAttempt < attempts.length) {
      const attemptConfig = attempts[currentAttempt];
      console.log(
        `[SerpApiService] Tentativa ${attemptConfig.step} executando query: "${attemptConfig.query}"`,
      );

      try {
        const response = await axios.get(this.API_URL, {
          params: {
            engine: "google_jobs",
            q: attemptConfig.query,
            hl: "pt",
            gl: "br",
            api_key: apiKey,
          },
        });

        const jobsResults = response.data?.jobs_results;

        if (
          jobsResults &&
          Array.isArray(jobsResults) &&
          jobsResults.length > 0
        ) {
          console.log(
            `[SerpApiService] Sucesso na tentativa ${attemptConfig.step}. ${jobsResults.length} vagas encontradas.`,
          );

          // Parser / Normalização dos dados de retorno
          const vagasPadronizadas: VagaPadronizada[] = jobsResults.map(
            (job: any) => {
              // Limita a descrição para economizar tokens na LLM
              const safeDescription = (job.description || "").substring(
                0,
                1000,
              );

              // Obtém o link_vaga: prefere o primeiro related_links ou o share_link do Google
              let link = job.share_link || "";
              if (
                job.related_links &&
                Array.isArray(job.related_links) &&
                job.related_links.length > 0
              ) {
                link = job.related_links[0].link || link;
              }

              return {
                titulo: job.title || "Vaga Não Especificada",
                empresa: job.company_name || "Empresa Confidencial",
                localizacao: job.location || "Brasil",
                link_vaga: link,
                descricao: safeDescription,
              };
            },
          );

          return vagasPadronizadas;
        } else {
          const nextAttempt = currentAttempt + 1;
          const nextQueryLog =
            nextAttempt < attempts.length
              ? attempts[nextAttempt].query
              : "Nenhuma (Fim das tentativas)";
          console.log(
            `[SerpApiService] Tentativa ${attemptConfig.step} falhou (0 vagas encontradas), tentando busca mais ampla com a query: [${nextQueryLog}]`,
          );

          currentAttempt++;
        }
      } catch (error: any) {
        if (error.response) {
          console.error(
            `[SerpApiService] Erro da API durante tentativa ${attemptConfig.step} (Status ${error.response.status}):`,
            error.response.data,
          );

          // Se for erro na chave da API, estourar cota, etc., interrompemos o loop.
          if (
            error.response.status === 401 ||
            error.response.status === 403 ||
            error.response.status === 429
          ) {
            throw new Error(
              `Credenciais inválidas ou limite da SerpApi estourado (Status ${error.response.status}).`,
            );
          }
        } else {
          console.error(
            `[SerpApiService] Erro interno ou de rede durante tentativa ${attemptConfig.step}:`,
            error.message,
          );
        }

        // Tenta continuar com a próxima degradação graciosa em caso de falha transitória
        currentAttempt++;
      }
    }

    console.warn(
      "[SerpApiService] Todas as tentativas da esteira de busca falharam. Retornando array vazio [].",
    );
    return [];
  }
}

/*
 * Exemplo de uso em um Controller (ResumeController ou MatchController):
 *
 * try {
 *   const cargoDesejado = "Desenvolvedor Node.js";
 *   const nivel = "Pleno";
 *   const vagas = await SerpApiService.buscarVagas(cargoDesejado, nivel);
 *   res.json({ vagas });
 * } catch (error) {
 *   res.status(500).json({ err: error.message });
 * }
 */
