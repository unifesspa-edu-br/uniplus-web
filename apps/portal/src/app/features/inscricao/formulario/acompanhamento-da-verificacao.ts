/** A espera antes de cada consulta, que cresce até o teto: o resultado costuma sair em poucos segundos. */
const ESPERAS_EM_MS: readonly number[] = [1000, 2000, 4000, 8000, 10000];

/** A espera antes da consulta de número `tentativa`, contada de zero; passado o fim da lista, vale o teto. */
export function esperaDaConsulta(tentativa: number): number {
  return ESPERAS_EM_MS[Math.min(tentativa, ESPERAS_EM_MS.length - 1)];
}

/**
 * Acompanha a verificação dos arquivos enviados: enquanto a avaliação traz arquivo em verificação, pede
 * a próxima avaliação depois de uma espera crescente, e para quando o resultado chega. Cada avaliação
 * que volta agenda a seguinte, então nunca há consulta em voo sobreposta nem tela presa esperando.
 */
export class AcompanhamentoDaVerificacao {
  private tentativa = 0;
  private espera: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly consultar: () => void) {}

  /** Chega uma avaliação nova: continua a consultar enquanto algum arquivo espera o resultado. */
  aoAvaliar(haArquivoEmVerificacao: boolean): void {
    this.cancelar();
    if (!haArquivoEmVerificacao) {
      this.tentativa = 0;
      return;
    }
    this.espera = setTimeout(() => {
      this.espera = null;
      this.consultar();
    }, esperaDaConsulta(this.tentativa++));
  }

  /** Um arquivo novo entrou em verificação: a espera volta ao começo, porque o resultado dele é recente. */
  recomecar(): void {
    this.tentativa = 0;
  }

  /** Sai da tela: nenhuma consulta pendente sobrevive. */
  parar(): void {
    this.cancelar();
    this.tentativa = 0;
  }

  private cancelar(): void {
    if (this.espera !== null) clearTimeout(this.espera);
    this.espera = null;
  }
}
