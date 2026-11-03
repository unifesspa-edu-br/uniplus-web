import {
  afterNextRender,
  effect,
  inject,
  Injectable,
  Injector,
  signal,
  untracked,
} from '@angular/core';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';

/** O que a linha do tempo mostra aberto: fases, etapas e os blocos de dentro de cada etapa. */
@Injectable()
export class ExpansaoDoCronograma {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cronograma = inject(FormularioDoCronograma);
  private readonly injector = inject(Injector);

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

  constructor() {
    // Quem chega de uma recusa que cita a fase cai nela: aberta e com o foco no campo da unidade.
    // O foco espera o passo estar visível e a troca de passo devolver o foco ao título.
    effect(() => {
      const codigo = this.store.faseEmFoco();
      if (codigo === null || !this.store.cronogramaVisivel()) return;
      const alvo = this.cronograma
        .linhaDoTempo()
        .find((item) => item.grupo.controls.codigo.value === codigo);
      untracked(() => this.store.faseEmFoco.set(null));
      if (alvo === undefined) return;
      untracked(() => {
        this.abrirFases([alvo.indice]);
        afterNextRender(
          () => setTimeout(() => document.getElementById(`cr-unidade-${alvo.indice}`)?.focus(), 0),
          { injector: this.injector },
        );
      });
    });
  }

  pedirRemocaoDaFase(indice: number): void {
    // Fase sem nada pendurado não precisa de confirmação: não há o que avisar.
    const dependentes = this.cronograma.dependentesDaFase(indice);
    if (dependentes.etapas === 0 && dependentes.documentos === 0) {
      this.remocaoAConfirmar.set(null);
      this.cronograma.removerFase(indice);
      return;
    }

    this.remocaoAConfirmar.set(indice);
  }

  confirmarRemocaoDaFase(indice: number): void {
    this.remocaoAConfirmar.set(null);
    this.cronograma.removerFase(indice);
  }

  /** O que a confirmação enuncia, na língua de quem monta o edital. */
  resumoDaRemocao(indice: number): string {
    const { etapas, documentos } = this.cronograma.dependentesDaFase(indice);
    const partes: string[] = [];
    if (etapas > 0) partes.push(etapas === 1 ? '1 etapa' : `${etapas} etapas`);
    if (documentos > 0) {
      partes.push(documentos === 1 ? '1 documento exigido' : `${documentos} documentos exigidos`);
    }
    return partes.join(' e ');
  }
}
