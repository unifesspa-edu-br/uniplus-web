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

export function textoDaFase(arquivo: ArquivoEmEnvio): string {
  switch (arquivo.fase) {
    case 'iniciando':
      return 'Preparando o envio';
    case 'enviando':
      return `Enviando: ${arquivo.progresso}%`;
    case 'confirmando':
      return 'Validando o arquivo';
    case 'verificando':
      return arquivo.mensagem || 'Arquivo em verificação';
    case 'confirmado':
      return 'Envio concluído';
    case 'erro':
      return 'O envio não foi concluído';
  }
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
