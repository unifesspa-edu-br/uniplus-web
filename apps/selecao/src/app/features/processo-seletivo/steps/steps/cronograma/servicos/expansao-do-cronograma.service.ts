import { Injectable, signal } from '@angular/core';

/** O que a linha do tempo mostra aberto: fases, etapas e os blocos de dentro de cada etapa. */
@Injectable()
export class ExpansaoDoCronograma {
  /**
   * As fases expandidas, por posição na linha do tempo.
   *
   * Todas fechadas ao chegar: o passo se chama linha do tempo, e sete cabeçalhos mostram a
   * linha inteira numa tela só. Abrir é um clique; o que está fechado continua sendo
   * gravado, e a conferência que recusa abre tudo de volta.
   */
  private readonly fasesExpandidas = signal<ReadonlySet<number>>(new Set());

  /**
   * As etapas abertas, por posição no formulário.
   *
   * Fechadas por padrão: cada etapa aberta passa de mil pixels, e a habilitação do certame
   * regional tem oito. Mais de uma pode ficar aberta ao mesmo tempo — comparar duas etapas é
   * pergunta legítima de quem monta o edital, e fechar a anterior a cada clique tiraria isso.
   */
  private readonly etapasAbertas = signal<ReadonlySet<number>>(new Set());

  /**
   * Os blocos abertos dentro de cada etapa, na chave `posição:bloco`.
   *
   * Recolhidos por padrão, como a etapa e a fase: cada janela recursal declarada ocupa uma
   * grade inteira, e a prova objetiva do certame qualificado abre duas.
   */
  private readonly blocosAbertos = signal<ReadonlySet<string>>(new Set());

  /**
   * A fase cuja remoção espera confirmação — ninguém perde etapa e documento sem ler antes
   * quanto vai junto.
   */
  readonly remocaoAConfirmar = signal<number | null>(null);

  faseExpandida(indice: number): boolean {
    return this.fasesExpandidas().has(indice);
  }

  alternarFase(indice: number): void {
    const abertas = new Set(this.fasesExpandidas());
    if (!abertas.delete(indice)) abertas.add(indice);
    this.fasesExpandidas.set(abertas);
  }

  /** Abre as fases informadas, sem fechar as que já estão abertas. */
  abrirFases(indices: readonly number[]): void {
    this.fasesExpandidas.update((abertas) => new Set([...abertas, ...indices]));
  }

  /** Abre todas — é o que a recusa da conferência faz, para não esconder o erro. */
  expandirTodasAsFases(indices: readonly number[]): void {
    this.fasesExpandidas.set(new Set(indices));
  }

  etapaAberta(posicao: number): boolean {
    return this.etapasAbertas().has(posicao);
  }

  alternarEtapa(posicao: number): void {
    const abertas = new Set(this.etapasAbertas());
    if (!abertas.delete(posicao)) abertas.add(posicao);
    this.etapasAbertas.set(abertas);
  }

  blocoAberto(posicao: number, bloco: 'recursos' | 'publica'): boolean {
    return this.blocosAbertos().has(`${posicao}:${bloco}`);
  }

  alternarBloco(posicao: number, bloco: 'recursos' | 'publica'): void {
    const abertos = new Set(this.blocosAbertos());
    const chave = `${posicao}:${bloco}`;
    if (!abertos.delete(chave)) abertos.add(chave);
    this.blocosAbertos.set(abertos);
  }

  desistirDaRemocao(): void {
    this.remocaoAConfirmar.set(null);
  }
}
