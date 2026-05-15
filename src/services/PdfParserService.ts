import pdfParse from "pdf-parse-debugging-disabled";

export class PdfParserService {
  /**
   * Extrai texto bruto de um arquivo PDF carregado na memória.
   * @param buffer Buffer do arquivo PDF
   * @returns String com o texto extraído
   */
  public static async parse(buffer: Buffer): Promise<string> {
    try {
      const data = await pdfParse(buffer);
      if (!data || !data.text) {
        throw new Error("O arquivo pode estar vazio ou ser uma imagem.");
      }
      return data.text;
    } catch (error: any) {
      console.error("[PdfParserService] Erro ao extrair texto do PDF:", error);
      throw new Error(`Falha ao ler o PDF: ${error.message}`);
    }
  }
}
