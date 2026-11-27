/** Onde o envio de um arquivo está: o componente só exibe, quem envia informa. */
export type FaseDoArquivo =
  | 'iniciando'
  | 'enviando'
  | 'confirmando'
  | 'verificando'
  | 'confirmado'
  | 'erro';

/** Um arquivo da lista, como o consumidor o reporta. */
export interface ArquivoEmEnvio {
  readonly id: string;
  readonly nome: string;
  readonly tamanhoBytes?: number;
  readonly fase: FaseDoArquivo;
  /** Percentual de 0 a 100. */
  readonly progresso: number;
  /** Texto da falha, exibido quando a fase é `erro`, ou o que se espera, quando é `verificando`. */
  readonly mensagem?: string | null;
  /** `false` quando repetir não adianta; o padrão é oferecer a nova tentativa. */
  readonly podeTentarDeNovo?: boolean;
  /** `false` quando o arquivo não pode mais sair da lista; o padrão é permitir. */
  readonly podeRetirar?: boolean;
  /** Descreve o arquivo no lugar do tamanho, quando quem envia sabe mais do que ele (formato, data do envio). */
  readonly detalhe?: string;
}

const PASSO_ANUNCIADO = 25;

const TEXTO_DA_FASE: Record<FaseDoArquivo, (arquivo: ArquivoEmEnvio) => string> = {
  iniciando: () => 'Preparando o envio',
  enviando: (arquivo) => `Enviando: ${arquivo.progresso}%`,
  confirmando: () => 'Validando o arquivo',
  verificando: (arquivo) => arquivo.mensagem || 'Arquivo em verificação',
  confirmado: () => 'Envio concluído',
  erro: () => 'O envio não foi concluído',
};

export function textoDaFase(arquivo: ArquivoEmEnvio): string {
  return TEXTO_DA_FASE[arquivo.fase](arquivo);
}

/**
 * O leitor de tela recebe o andamento em passos: anunciar cada percentual interromperia
 * quem lê a página a cada fração de segundo.
 */
export function anuncioDaFase(arquivo: ArquivoEmEnvio): string {
  if (arquivo.fase !== 'enviando') return `${arquivo.nome}: ${textoDaFase(arquivo)}`;
  const passo = Math.floor(arquivo.progresso / PASSO_ANUNCIADO) * PASSO_ANUNCIADO;
  return `${arquivo.nome}: enviando, ${passo}%`;
}
