import {
  ElementRef,
  Injector,
  Signal,
  afterNextRender,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { detectarFimDaOperacao, focoEstaLivre } from '../../shared/foco';

export interface OpcoesDoFocoDaGrade {
  /** Há escrita em curso ou recarga do calendário a caminho. */
  readonly gravando: Signal<boolean>;
  /** O diálogo da escrita está aberto: enquanto estiver, o foco é dele. */
  readonly aberto: Signal<boolean>;
  /** A data do dia cujo botão abriu o painel, em `AAAA-MM-DD`. */
  readonly dataDoDia: () => string | null | undefined;
  /** `id` do título da página, destino quando o botão do dia saiu da grade. */
  readonly idDoTitulo: string;
}

/**
 * Terminadas a inclusão e a recarga, o foco volta ao botão do dia: o painel e o diálogo fecham, e
 * o botão do dia vazio é substituído por outro quando o dia ganha a primeira ocorrência, de modo
 * que o foco cairia no `body`. Sem o botão (a recarga falhou e a grade saiu da tela), vai ao
 * título da página. Só age com o foco livre.
 *
 * Chamar em contexto de injeção, no componente da página que contém a grade.
 */
export function devolverFocoDaGrade(opcoes: OpcoesDoFocoDaGrade): void {
  const raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const injector = inject(Injector);
  const gravacaoTerminou = detectarFimDaOperacao(opcoes.gravando);

  effect(() => {
    if (gravacaoTerminou() && !untracked(opcoes.aberto)) {
      afterNextRender(() => devolverFocoAoDia(raiz, opcoes), { injector });
    }
  });
}

function devolverFocoAoDia(raiz: HTMLElement, opcoes: OpcoesDoFocoDaGrade): void {
  if (!focoEstaLivre()) {
    return;
  }
  const data = opcoes.dataDoDia();
  const botao = data ? raiz.querySelector<HTMLElement>(`button[data-dia="${data}"]`) : null;
  (botao ?? raiz.querySelector<HTMLElement>(`#${opcoes.idDoTitulo}`))?.focus();
}
