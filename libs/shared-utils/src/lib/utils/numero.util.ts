/**
 * Formatador único: construir um `Intl.NumberFormat` custa mais do que formatar, e as telas
 * formatam a cada detecção de mudanças.
 */
const FORMATADOR_PT_BR = new Intl.NumberFormat('pt-BR');

/**
 * Número como as telas do Uni+ o mostram: pt-BR, vírgula decimal, sem casas fixas (`2`, `1,5`,
 * `400`). É a forma do cadastro de Peso por Área, e quem mostra o mesmo dado noutro app usa esta
 * mesma função para os dois não divergirem.
 */
export function formatarNumeroPtBr(valor: number): string {
  return FORMATADOR_PT_BR.format(valor);
}

/**
 * Decimal como a API o serializa: número, ou texto quando o valor não cabe sem perda num `number`
 * do JSON (o contrato declara `number | string`).
 */
export function numeroDaApi(valor: number | string): number {
  return typeof valor === 'number' ? valor : Number(valor);
}

/** O mesmo, para campo opcional: ausente ou `null` continua `null`. */
export function numeroOuNuloDaApi(valor: number | string | null | undefined): number | null {
  return valor === null || valor === undefined ? null : numeroDaApi(valor);
}
