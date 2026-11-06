import { ElementRef, Injector, Signal, afterNextRender, effect, inject } from '@angular/core';
import { focoEstaLivre } from '../../shared/foco';

type AcaoDoNo = 'editar' | 'remover';

/** De onde a pessoa acionou: uma ação sobre o nó `id`, ou `null` para o cadastro. */
export type AcionadorDaArvore = { readonly acao: AcaoDoNo; readonly id: string } | null;

export interface OpcoesDoFocoDaArvore {
  /** Há escrita em curso, de qualquer tipo. */
  readonly gravando: Signal<boolean>;
  /** A lista está sendo lida (inclui a recarga que segue a escrita). */
  readonly carregando: Signal<boolean>;
  /** Alguma sobreposição aberta a partir da lista (formulário, confirmação ou detalhe). */
  readonly sobreposicaoAberta: Signal<boolean>;
}

export interface FocoDaArvore {
  /** Anota de onde a pessoa acionou; vale até a próxima anotação. */
  registrar(acionador: AcionadorDaArvore): void;
}

const ID_DO_TITULO = 'cfg-unidades-list-title';
const ID_DO_CADASTRO = 'cfg-unidades-novo';

const entreAspas = (valor: string): string => valor.replace(/["\\]/g, '\\$&');

function localizar(raiz: HTMLElement, acionador: AcionadorDaArvore): HTMLElement | null {
  if (acionador === null) {
    return raiz.querySelector<HTMLElement>(`#${ID_DO_CADASTRO}`);
  }
  const prefixo = acionador.acao === 'editar' ? 'Editar ' : 'Remover ';
  const no = `[data-unidade-id="${entreAspas(acionador.id)}"]`;
  return raiz.querySelector<HTMLElement>(`${no} button[aria-label^="${prefixo}"]:not(:disabled)`);
}

/**
 * A árvore não é uma tabela, então o `devolverFocoDaLista` compartilhado, que procura a linha
 * como `tr`, não a alcança. Terminadas a escrita e a recarga, e também ao fechar uma sobreposição
 * sem gravar, o foco volta ao acionador, localizado pelo id do nó, se ele ainda existir e se
 * ninguém tomou o foco nesse intervalo; sem ele, vai ao título da lista.
 *
 * Chamar em contexto de injeção, no componente que contém a lista.
 */
export function devolverFocoDaArvore(opcoes: OpcoesDoFocoDaArvore): FocoDaArvore {
  const raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const injector = inject(Injector);
  let ultimo: AcionadorDaArvore | undefined;
  let ocupada = false;

  const devolver = (acionador: AcionadorDaArvore): void => {
    if (!focoEstaLivre()) return;
    const titulo = raiz.querySelector<HTMLElement>(`#${ID_DO_TITULO}`);
    (localizar(raiz, acionador) ?? titulo)?.focus();
  };

  effect(() => {
    if (opcoes.gravando() || opcoes.sobreposicaoAberta()) {
      ocupada = true;
      return;
    }
    if (opcoes.carregando() || !ocupada) return;
    ocupada = false;
    const acionador = ultimo;
    ultimo = undefined;
    if (acionador !== undefined) {
      afterNextRender(() => devolver(acionador), { injector });
    }
  });

  return {
    registrar: (acionador) => {
      ultimo = acionador;
    },
  };
}
