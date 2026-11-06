import { ElementRef, Injector, Signal, afterNextRender, effect, inject } from '@angular/core';
import { focoEstaLivre } from './foco-livre';

type AcaoDaLinha = 'editar' | 'remover' | 'revogar' | 'situacao';

/** O botão de cada ação dentro da linha; o da situação troca de rótulo ao ser acionado. */
const SELETOR_DA_ACAO: Readonly<Record<AcaoDaLinha, string>> = {
  editar: 'button[aria-label^="Editar "]',
  remover: 'button[aria-label^="Remover "]',
  revogar: 'button[aria-label^="Revogar "]',
  situacao:
    ':is(button[aria-label^="Ativar "], button[aria-label^="Desativar "], button[aria-label^="Reativar "])',
};

/** O valor como literal entre aspas duplas de um seletor de atributo. */
const entreAspas = (valor: string): string => valor.replace(/["\\]/g, '\\$&');

/** De onde a pessoa acionou a escrita: uma ação sobre a linha `id`, ou `null` para o cadastro. */
export type AcionadorDaLista = { readonly acao: AcaoDaLinha; readonly id: string } | null;

export interface OpcoesDaDevolucaoDeFoco {
  /** Há escrita em curso, de qualquer tipo. */
  readonly gravando: Signal<boolean>;
  /** A lista está sendo lida (inclui a recarga que segue a escrita). */
  readonly carregando: Signal<boolean>;
  /** Atributo da linha que guarda o id do item, como `data-campus-id`. */
  readonly atributoDaLinha: string;
  /** Elemento que carrega o atributo da linha: `tr` na tabela, `li` na árvore. */
  readonly elementoDaLinha?: string;
  /**
   * Alguma sobreposição aberta a partir da lista (formulário, confirmação ou detalhe). Ao fechar
   * sem gravar o foco também volta, e o acionador anotado vale uma vez só: abrir um detalhe que
   * não anota o acionador não leva o foco a um acionador antigo.
   */
  readonly sobreposicaoAberta?: Signal<boolean>;
  /** `id` do título da lista, destino quando o acionador saiu da tela. */
  readonly idDoTitulo: string;
  /** `id` do botão de cadastro, dentro ou fora da lista; sem ele, o cadastro devolve o foco ao título. */
  readonly idDoCadastro?: string;
}

export interface DevolucaoDeFoco {
  /** Anota de onde a pessoa acionou; vale até a próxima anotação, pois a escrita refeita após uma recusa parte do mesmo acionador. */
  registrar(acionador: AcionadorDaLista): void;
}

class DevolucaoDeFocoDaLista implements DevolucaoDeFoco {
  private ultimo: AcionadorDaLista | undefined;
  private ocupada = false;

  constructor(
    private readonly raiz: HTMLElement,
    private readonly injector: Injector,
    private readonly opcoes: OpcoesDaDevolucaoDeFoco,
  ) {}

  registrar(acionador: AcionadorDaLista): void {
    this.ultimo = acionador;
  }

  /** Lê os sinais da lista; roda dentro de um `effect`. */
  acompanhar(): void {
    if (this.opcoes.gravando() || this.opcoes.sobreposicaoAberta?.()) {
      this.ocupada = true;
      return;
    }
    if (this.opcoes.carregando() || !this.ocupada) {
      return;
    }
    this.ocupada = false;
    const acionador = this.ultimo;
    if (this.opcoes.sobreposicaoAberta) this.ultimo = undefined;
    if (acionador !== undefined) {
      afterNextRender(() => this.devolver(acionador), { injector: this.injector });
    }
  }

  private devolver(acionador: AcionadorDaLista): void {
    if (!focoEstaLivre()) {
      return;
    }
    const titulo = this.raiz.querySelector<HTMLElement>(`#${this.opcoes.idDoTitulo}`);
    (this.localizar(acionador) ?? titulo)?.focus();
  }

  private localizar(acionador: AcionadorDaLista): HTMLElement | null {
    if (acionador === null) {
      const { idDoCadastro } = this.opcoes;
      return idDoCadastro ? this.raiz.querySelector<HTMLElement>(`#${idDoCadastro}`) : null;
    }
    const elemento = this.opcoes.elementoDaLinha ?? 'tr';
    const linha = `${elemento}[${this.opcoes.atributoDaLinha}="${entreAspas(acionador.id)}"]`;
    return this.raiz.querySelector<HTMLElement>(
      `${linha} ${SELETOR_DA_ACAO[acionador.acao]}:not(:disabled)`,
    );
  }
}

/**
 * As ações da lista ficam indisponíveis enquanto ela é gravada e recarregada, e um botão
 * indisponível não recebe o foco que a sobreposição fechada tenta devolver. Terminadas a escrita
 * e a recarga, o foco volta ao acionador, localizado pelo id da linha ou do nó (o nome acessível muda com
 * o conteúdo e pode se repetir), se ele ainda existir e se ninguém tomou o foco nesse intervalo;
 * sem ele (item removido, lista que falhou ao recarregar), vai ao título da lista.
 *
 * Chamar em contexto de injeção, no componente da lista ou da página que a contém (o botão de
 * cadastro pode ficar fora da lista, desde que dentro dele).
 */
export function devolverFocoDaLista(opcoes: OpcoesDaDevolucaoDeFoco): DevolucaoDeFoco {
  const raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const devolucao = new DevolucaoDeFocoDaLista(raiz, inject(Injector), opcoes);
  effect(() => devolucao.acompanhar());
  return devolucao;
}
