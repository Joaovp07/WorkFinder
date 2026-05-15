import Groq from "groq-sdk";
import { Resend } from "resend";
import { fetchJobs } from "./fetchJobs";

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
  private groq: Groq;

  constructor() {
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || "YOUR_GROQ_API_KEY",
    });
  }

  /**
   * Processa o fluxo completo
   * 1. Busca Vagas
   * 2. Usa IA Llama 3 para Match
   * 3. Dispara E-mail
   */
  public async executeFlow(candidato: Candidato) {
    console.log(`[MatchService] Iniciando fluxo para o candidato: ${candidato.nome} (${candidato.cargo})`);

    // 1. Busca as vagas (Mock da Remotive)
    const searchTerm = candidato.cargo || "developer";
    const vagasCapturadas: Vaga[] = await fetchJobs(searchTerm);

    if (vagasCapturadas.length === 0) {
      console.warn("[MatchService] Nenhuma vaga encontrada.");
      return [];
    }

    console.log(`[MatchService] Foram capturadas ${vagasCapturadas.length} vagas. Analisando perfil com o Llama 3...`);

    // 2. Análise via Llama 3 - 70B (Velocidade e Precisão) usando Groq
    const melhoresVagas = await this.analyzeMatchWithIA(candidato, vagasCapturadas);

    // 3. Disparo do Email via Resend
    if (candidato.email && melhoresVagas.length > 0) {
      await this.sendEmailViaResend(candidato, melhoresVagas);
    }

    return melhoresVagas;
  }

  /**
   * Integração com o Llama 3 através do Llama 3 Groq
   */
  private async analyzeMatchWithIA(candidato: Candidato, vagas: Vaga[]) {
    // Prompt de Sistema extremamente rigoroso para retornar um JSON puro Validável.
    const systemPrompt = `Você é um avaliador de carreiras Sênior atuando estritamente como uma API de retorno de dados.
Sua única função é avaliar o perfil do CANDIDATO contra a lista de VAGAS recebidas e ranqueá-las com um score de 0 a 100.
O Score DEVE ser calculado com a seguinte base:
- Tecnologias e Stack: 45 pontos (o quanto cruza com o que o dev sabe)
- Nível (Junior/Pleno/Senior): 20 pontos
- Modelo (Remoto/Híbrido/Presencial): 15 pontos
- Cargo (Semântica do título vs busca): 10 pontos
- Localidade / Resumo (Opcional): 10 pontos

RETORNE ESTRITAMENTE UM JSON VÁLIDO no seguinte formato (uma array de objetos):
[
  {
    "vagaId": "indicar o index do array ou ID virtual para referenciar a vaga no frontend",
    "titulo": "titulo da vaga original",
    "empresa": "nome da empresa",
    "compatibilidade": 95,
    "localizacao": "localizacao",
    "modelo": "remoto",
    "tecnologias": ["React", "Node"],
    "motivos": ["Motivo claro 1", "Motivo claro 2"],
    "link_vaga": "url_da_vaga"
  }
]
- Não retorne NENHUMA quebra de bloco de código (\`\`\`json ou \`\`\`).
- Apenas a reposta iniciando com [ e terminando com ].
- Retorne no máximo 5 melhores vagas.
`;

    // Criando a mensagem de User dinamicamente com os dados serializados
    const userPrompt = `
      CANDIDATO:
      ${JSON.stringify({
        nome: candidato.nome,
        cargo: candidato.cargo,
        nivel: candidato.nivel,
        tecnologias: candidato.tecnologias,
        resumo: candidato.resumo
      }, null, 2)}
      
      VAGAS_CAPTURADAS:
      ${JSON.stringify(vagas.map((v, index) => ({ id: index, ...v })), null, 2)}
    `;

    try {
      const response = await this.groq.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        model: "llama-3.3-70b-versatile", // Llama 3 70B via Groq tem retornos absurdamente rápidos
        temperature: 0.1, // temperatura baixa para respostas determinísticas
        max_tokens: 1024,
      });

      const responseText = response.choices[0]?.message?.content || "[]";
      
      console.log("[MatchService] Resposta do GROQ recebida:", responseText.trim().substring(0, 150) + "...");
      
      // Validação do output JSON e parse
      let parsedJobs = [];
      try {
        parsedJobs = JSON.parse(responseText.trim());
      } catch (parseErr) {
        console.error("[MatchService] Falha ao fazer parse do JSON do Groq.", responseText);
        // Fallback simples se a IA encher de sujeira o JSON
        const matcher = responseText.match(/\[.*\]/s);
        if (matcher) {
           parsedJobs = JSON.parse(matcher[0]);
        }
      }

      // Ordenar vagas por maior compatibilidade
      parsedJobs.sort((a: any, b: any) => b.compatibilidade - a.compatibilidade);

      return parsedJobs;
      
    } catch (error) {
      console.error("[MatchService] Erro na API do Groq:", error);
      throw error;
    }
  }

  /**
   * Módulo de Serviço de E-mail via Resend
   */
  private async sendEmailViaResend(candidato: Candidato, vagasRanqueadas: any[]) {
    try {
      const resendApiKey = process.env.RESEND_API_KEY;
      
      if (!resendApiKey) {
        console.warn("[MatchService] RESEND_API_KEY não configurada. O e-mail não será enviado.");
        return;
      }

      console.log(`[MatchService] Enviando e-mail via Resend para ${candidato.email}...`);
      const resend = new Resend(resendApiKey);

      let htmlVagas = vagasRanqueadas.map((v: any) => `
        <div style="margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px;">
          <h3>${v.titulo} na ${v.empresa}</h3>
          <p><strong>Compatibilidade:</strong> <span style="color: green;">${v.compatibilidade}%</span></p>
          <p><strong>Por que escolhemos esta vaga?</strong></p>
          <ul>
            ${v.motivos.map((m: string) => `<li>${m}</li>`).join('')}
          </ul>
          <a href="${v.link_vaga}" style="display:inline-block; padding:10px 15px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Candidatar-se</a>
        </div>
      `).join("");

      const { data, error } = await resend.emails.send({
        from: 'WorkFinder AI <onboarding@resend.dev>', // Resend standard testing email
        to: candidato.email,
        subject: `✅ Encontramos vagas ideais para você, ${candidato.nome}!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
            <h2>Olá, ${candidato.nome}! 👋</h2>
            <p>O nosso motor de IA Llama 3 ranqueou ${vagasRanqueadas.length} vagas perfeitas de acordo com o seu perfil!</p>
            <hr />
            ${htmlVagas}
            <br />
            <p>Boa sorte nas candidaturas!</p>
            <p><strong>Equipe WorkFinder AI</strong></p>
          </div>
        `,
      });

      if (error) {
        console.error(`[MatchService] Erro da API do Resend:`, error);
      } else {
        console.log("[MatchService] E-mail enviado com sucesso via Resend! ID:", data?.id);
      }
    } catch (err) {
      console.error("[MatchService] Erro inesperado ao tentar enviar e-mail pelo Resend:", err);
    }
  }
}
