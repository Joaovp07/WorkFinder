import { GoogleGenAI } from "@google/genai";

export interface ResumeProfile {
  nome_completo: string | null;
  email: string | null;
  cidade_estado: string | null;
  links: {
    linkedin: string | null;
    github: string | null;
  } | null;
  preferencia_trabalho: string | null;
  cargo_desejado: string | null;
  nivel_profissional: string | null;
  tecnologias_conhecidas: string[] | null;
  experiencias_profissionais: Array<{
    empresa: string;
    cargo: string;
    periodo: string;
    descricao_curta: string;
  }> | null;
  formacao_academica: Array<{
    instituicao: string;
    curso: string;
    status: string;
  }> | null;
  resumo_profissional: string | null;
}

export class ResumeAnalyzerService {
  private static gemini: GoogleGenAI | null = null;

  /**
   * Analisa o texto bruto do currículo usando IA (Gemini)
   * e retorna as informações estruturadas em JSON.
   */
  public static async analyze(rawText: string): Promise<ResumeProfile> {
    if (!this.gemini) {
      const apiKey = "AIzaSyB5zZq2d_4AgYbnt76TcBOiLkiVSp39c7A" || process.env["GEMINI_API_KEY-1"] || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY não configurada.");
      }
      this.gemini = new GoogleGenAI({ apiKey: apiKey });
    }

    const systemPrompt = `Você é um Engenheiro de Dados e Analista de RH especialista em parsing estruturado.
Sua única função é extrair informações do texto bruto de um currículo fornecido e retornar ESTRITAMENTE um objeto JSON válido.

Extraia EXATAMENTE as seguintes propriedades com precisão:
- "nome_completo": (String) Nome completo do candidato.
- "email": (String) E-mail detectado.
- "cidade_estado": (String) Cidade e estado, se houver.
- "links": (Objeto) Deve conter "linkedin" (String) e "github" (String).
- "preferencia_trabalho": (String) Deve ser "Remoto", "Híbrido", "Presencial" ou "Indiferente" (infira pelo texto).
- "cargo_desejado": (String) O cargo principal almejado ou a área principal de atuação.
- "nivel_profissional": (String) Infira como "Estágio", "Júnior", "Pleno" ou "Sênior".
- "tecnologias_conhecidas": (Array de Strings) Linguagens, frameworks, bancos de dados, etc.
- "experiencias_profissionais": (Array de Objetos) Cada objeto deve ter: "empresa" (String), "cargo" (String), "periodo" (String) e "descricao_curta" (String).
- "formacao_academica": (Array de Objetos) Cada objeto deve ter: "instituicao" (String), "curso" (String) e "status" (String).
- "resumo_profissional": (String) Um parágrafo resumindo o perfil.

--------------------------------------------
REGRAS ESTRITAS DE SAÍDA:
1. O retorno NÃO DEVE conter NENHUM texto Markdown, NENHUM bloco como \`\`\`json, e NENHUMA saudação ou comentário.
2. A sua resposta DEVE COMEÇAR e TERMINAR com as chaves "{" e "}" formando um JSON perfeitamente válido.
3. Se você não encontrar uma informação no texto do PDF, retorne null caso seja String, ou um array vazio [] para Listas.
4. NUNCA INVENTE DADOS.
--------------------------------------------`;

    // Limitando a string caso o PDF tenha gerado um lixo mto grande
    const safeText = rawText.substring(0, 10000);
    const userPrompt = `Extraia as informações deste currículo:\n\n${safeText}`;

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
          console.warn(`[ResumeAnalyzerService] Gemini API is busy. Retries left: ${retries - 1}. Waiting ${delay}ms...`);
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

      const responseText = response.text || "{}";

      let parsed: ResumeProfile;
      try {
        parsed = JSON.parse(responseText.trim());
      } catch (parseErr) {
        console.error(
          "[ResumeAnalyzerService] Resposta não-JSON da IA:",
          responseText,
        );
        // Fallback p/ extrair o json no meio do texto
        const match = responseText.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error(
            "A Inteligência Artificial não retornou um formato JSON válido.",
          );
        }
      }

      return parsed;
    } catch (error: any) {
      console.error(
        "[ResumeAnalyzerService] Erro ao analisar o texto com Gemini API:",
        error,
      );
      if (error.message && error.message.includes("API key not valid")) {
        throw new Error("A chave de API configurada no projeto (GEMINI_API_KEY) é inválida. Por favor, remova a chave configurada manualmente nas opções do App ou forneça uma chave do Google AI Studio válida.");
      }
      throw new Error(`Falha no processamento via IA: ${error.message}`);
    }
  }
}
