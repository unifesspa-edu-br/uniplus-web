import {
  afterNextRender,
  computed,
  type Injector,
  linkedSignal,
  type Signal,
  type WritableSignal,
} from '@angular/core';

import type { PassoPrefixado } from './formulario-do-candidato.model';
import { contemOCampo } from './recusas-do-servidor';
import type { SimulacaoDoFormulario } from './interpretador/regras-do-formulario';
import type { PassoDoFormulario } from './passos-do-formulario';

/** De onde a navegação parte, e o que a faz recomeçar. */
export interface FontesDaNavegacao {
  readonly partida: Signal<unknown>;
  readonly inicial: Signal<SimulacaoDoFormulario | null>;
  /** Lidos sob demanda: os passos dependem do que a navegação já concluiu. */
  readonly passos: () => readonly PassoDoFormulario[];
  readonly passosPrefixados: () => readonly PassoPrefixado[];
  readonly injector: Injector;
  /** O elemento do formulário, onde se procuram os controles. */
  readonly raiz: () => HTMLElement;
  /** O título da seção atual, onde o foco cai quando nada mais é indicado. */
  readonly titulo: () => HTMLElement | null;
}

/** O estado que recomeça a cada partida nova: outro formulário ou outra simulação inicial. */
function aCadaPartida<T>(partida: Signal<unknown>, inicio: () => T): WritableSignal<T> {
  return linkedSignal<unknown, T>({ source: partida, computation: inicio });
}

/**
 * Onde o candidato está entre os passos — os prefixados e, depois, as seções —, o que ele já deu como
 * concluído e o caminho até um passo ou campo, com o foco. É a única dona desse estado.
 */
export class NavegacaoDosPassos {
  /** As etapas das regras dadas como concluídas: entram na simulação. */
  readonly concluidas: WritableSignal<ReadonlySet<string>>;
  /** Os blocos do sistema dados como concluídos, pela chave do passo: eles não têm etapa nas regras. */
  private readonly blocosConcluidos: WritableSignal<ReadonlySet<string>>;
  /** As seções a que o link da pendência levou: mostram as pendências sem serem dadas como concluídas. */
  private readonly pendenciaMostrada: WritableSignal<ReadonlySet<string>>;
  /**
   * O passo escolhido, pela chave: a resposta que esconde ou mostra outra seção não troca a seção em
   * que o candidato está. Se o escolhido some, fica o da mesma posição.
   */
  private readonly escolhida: WritableSignal<{ chave: string | null; indice: number }>;

  /** As chaves de todos os passos na ordem em que aparecem: os prefixados e, depois, as seções. */
  readonly chaves: Signal<readonly string[]>;
  readonly total: Signal<number>;
  /** O índice entre todos os passos — os prefixados primeiro, depois as seções. */
  readonly indice: Signal<number>;
  readonly chaveAtual: Signal<string | null>;
  readonly passoAtual: Signal<PassoDoFormulario | null>;
  readonly prefixadoAtual: Signal<PassoPrefixado | null>;

  constructor(private readonly fontes: FontesDaNavegacao) {
    const { partida, inicial, passos, passosPrefixados } = fontes;
    this.concluidas = aCadaPartida(partida, () => new Set(inicial()?.etapasConcluidas ?? []));
    this.blocosConcluidos = aCadaPartida(partida, () => new Set<string>());
    this.pendenciaMostrada = aCadaPartida(partida, () => new Set<string>());
    this.escolhida = aCadaPartida(partida, () => ({ chave: null as string | null, indice: 0 }));
    this.chaves = computed(() => [...passosPrefixados(), ...passos()].map((p) => p.chave));
    this.total = computed(() => this.chaves().length);
    this.indice = computed(() => {
      const { chave, indice } = this.escolhida();
      const achado = chave === null ? -1 : this.chaves().indexOf(chave);
      return achado >= 0 ? achado : Math.max(0, Math.min(indice, this.total() - 1));
    });
    this.chaveAtual = computed(() => this.chaves()[this.indice()] ?? null);
    this.passoAtual = computed(() => passos().find((p) => p.chave === this.chaveAtual()) ?? null);
    this.prefixadoAtual = computed(
      () => passosPrefixados().find((p) => p.chave === this.chaveAtual()) ?? null,
    );
  }

  concluido(passo: PassoDoFormulario): boolean {
    return passo.etapasNasRegras.length > 0
      ? passo.etapasNasRegras.every((e) => this.concluidas().has(e))
      : this.blocosConcluidos().has(passo.chave);
  }

  /** Se a seção mostra a pendência em cada campo: concluída, ou visitada pelo link da pendência. */
  mostraPendencia(passo: PassoDoFormulario): boolean {
    return this.concluido(passo) || this.pendenciaMostrada().has(passo.chave);
  }

  mostrarPendenciaDe(chave: string): void {
    this.pendenciaMostrada.update((atual) => new Set([...atual, chave]));
  }

  escolher(destino: number): void {
    this.escolhida.set({ chave: this.chaves()[destino] ?? null, indice: destino });
  }

  /**
   * Dá os passos como concluídos — as etapas das regras e, no bloco do sistema, a chave — e diz se algo
   * mudou. O passo já concluído não muda a simulação: o conjunto só é trocado quando ganha algo novo.
   */
  concluir(passos: readonly PassoDoFormulario[]): boolean {
    const etapasNovas = passos
      .flatMap((p) => p.etapasNasRegras)
      .filter((e) => !this.concluidas().has(e));
    const blocosNovos = passos
      .filter((p) => p.etapasNasRegras.length === 0 && !this.blocosConcluidos().has(p.chave))
      .map((p) => p.chave);
    if (etapasNovas.length > 0)
      this.concluidas.update((atual) => new Set([...atual, ...etapasNovas]));
    if (blocosNovos.length > 0)
      this.blocosConcluidos.update((atual) => new Set([...atual, ...blocosNovos]));
    return etapasNovas.length > 0 || blocosNovos.length > 0;
  }

  /**
   * Troca de seção e leva o foco ao título dela, para quem navega por teclado ou leitor de tela, ou ao
   * elemento que `foco` indicar depois de a seção aparecer. Na seção em que o candidato já está não há o
   * que esperar: o foco vai na hora, sem ficar pendente para uma renderização qualquer depois — salvo
   * quando `depoisDeRenderizar` diz que o alvo ainda vai aparecer.
   */
  irPara(indice: number, foco?: () => HTMLElement | null, depoisDeRenderizar = false): void {
    const destino = Math.max(0, Math.min(indice, this.total() - 1));
    const focar = (): void => (foco?.() ?? this.fontes.titulo())?.focus();
    const mesmaSecao = destino === this.indice();
    this.escolher(destino);
    if (mesmaSecao && !depoisDeRenderizar) focar();
    else afterNextRender(focar, { injector: this.fontes.injector });
  }

  /**
   * Leva a um passo pela chave — de quem hospeda ou uma seção — e põe o foco no título dele, ou no
   * elemento que `foco` indicar depois de o passo aparecer.
   */
  irAoPasso(chave: string, foco?: () => HTMLElement | null, depoisDeRenderizar = false): void {
    const indice = this.chaves().indexOf(chave);
    if (indice >= 0) this.irPara(indice, foco, depoisDeRenderizar);
  }

  /**
   * Vai à seção do campo, grupo ou termo e põe o foco no primeiro controle dele — o recusado pelo
   * servidor ou a pergunta que falta para calcular as modalidades.
   */
  irAoCampo(campo: string): void {
    const passo = this.fontes.passos().find((p) => contemOCampo(p, campo));
    if (passo) this.irAoPasso(passo.chave, () => this.controleDe(campo, false));
  }

  irASecao(chave: string): void {
    if (this.fontes.passos().some((passo) => passo.chave === chave)) this.irAoPasso(chave);
  }

  /**
   * O primeiro controle do campo, grupo ou termo, ou o da confirmação do campo; o campo de uma
   * ocorrência cai no grupo dela.
   */
  controleDe(campo: string, naConfirmacao: boolean): HTMLElement | null {
    const partes = Array.from(this.fontes.raiz().querySelectorAll<HTMLElement>('[data-campo]'));
    const alvo =
      partes.find((p) => p.dataset['campo'] === campo) ??
      partes.find((p) => p.dataset['campo'] === campo.split('.')[0]);
    return (
      alvo?.querySelector<HTMLElement>(
        naConfirmacao ? 'input[id$="-confirmacao"]' : 'input, select, textarea, button',
      ) ?? null
    );
  }
}
