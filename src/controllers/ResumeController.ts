import { Request, Response } from "express";
import { PdfParserService } from "../services/PdfParserService";
import { ResumeAnalyzerService } from "../services/ResumeAnalyzerService";

export class ResumeController {
  /**
   * Controller que orquestra o recebimento do PDF, extração de texto
   * e processamento com Inteligência Artificial para retornar o JSON.
   */
  public static async analyzeResume(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const curriculoBase64 = req.body.curriculoBase64;
      if (!curriculoBase64) {
        res
          .status(400)
          .json({ error: "Nenhum arquivo PDF foi enviado (base64 ausente)." });
        return;
      }

      console.log(
        `[ResumeController] Iniciando processamento do currículo via Base64 (Tamanho aprox: ${curriculoBase64.length} caracteres)`,
      );

      const buffer = Buffer.from(curriculoBase64, "base64");

      // 1. Extrai o texto do PDF usando módulo de parser
      const rawText = await PdfParserService.parse(buffer);

      console.log(
        "[ResumeController] Texto extraído com sucesso. Iniciando análise via IA...",
      );

      // 2. Envia para a IA estruturar p/ JSON
      const profile = await ResumeAnalyzerService.analyze(rawText);

      console.log("[ResumeController] IA decodificou o currículo com sucesso!");

      res.status(200).json(profile);
    } catch (error: any) {
      console.error(
        "[ResumeController] Erro na rota de analisar currículo:",
        error,
      );
      res.status(500).json({
        error: "Ocorreu um erro ao processar o currículo.",
        details: error.message || String(error),
      });
    }
  }
}
