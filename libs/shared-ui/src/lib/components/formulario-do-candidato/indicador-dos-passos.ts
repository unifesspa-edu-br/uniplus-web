import { computed, type Signal } from '@angular/core';

import type { StepItem } from '../steps/steps.component';
import type { PassoPrefixado } from './formulario-do-candidato.model';
import type { NavegacaoDosPassos } from './navegacao-dos-passos';
import type { PassoDoFormulario } from './passos-do-formulario';

/** O que o indicador mostra dos passos: o que a tela sabe e a navegação não. */
export interface FontesDoIndicador {
  readonly navegacao: NavegacaoDosPassos;
  readonly passos: () => readonly PassoDoFormulario[];
  readonly passosPrefixados: () => readonly PassoPrefixado[];
  /** As chaves das seções com pendência: a seção concluída que ainda tem uma não passa por pronta. */
  readonly comPendencia: () => ReadonlySet<string>;
  /** Se o servidor recusou alguma resposta da seção. */
  readonly comRecusa: (passo: PassoDoFormulario) => boolean;
}

/** Como os passos se apresentam ao candidato: o indicador, a posição, o progresso e os rótulos dos botões. */
export class IndicadorDosPassos {
  readonly itens: Signal<StepItem[]>;
  /** Quantos passos já estão concluídos, entre todos, para a barra de progresso. */
  readonly progresso: Signal<number>;
  /** Onde o candidato está, para o leitor de tela e para a barra: a posição entre todos os passos. */
  readonly posicao: Signal<string>;
  /** Os botões chamam de passo o que não é seção do formulário e de seção o que é. */
  readonly rotuloDoAnterior: Signal<string>;
  readonly rotuloDoProximo: Signal<string>;
  /** Com passos de quem hospeda a lista reúne passos, não só seções do formulário. */
  readonly rotuloDaNavegacao: Signal<string>;
  readonly nomeDaLista: Signal<string>;
  readonly tituloDoPassoAtual: Signal<string>;

  constructor(fontes: FontesDoIndicador) {
    const { navegacao } = fontes;
    const temPrefixados = computed(() => fontes.passosPrefixados().length > 0);
    this.itens = computed(() => itensDosPassos(fontes));
    this.progresso = computed(
      () =>
        (this.itens().filter((item) => item.concluido === true).length / navegacao.total()) * 100,
    );
    this.posicao = computed(
      () =>
        `${temPrefixados() ? 'Passo' : 'Seção'} ${navegacao.indice() + 1} de ${navegacao.total()}`,
    );
    this.rotuloDoAnterior = computed(() => {
      const prefixados = fontes.passosPrefixados().length;
      return prefixados > 0 && navegacao.indice() <= prefixados
        ? 'Passo anterior'
        : 'Seção anterior';
    });
    this.rotuloDoProximo = computed(() =>
      navegacao.passoAtual() ? 'Próxima seção' : 'Próximo passo',
    );
    this.rotuloDaNavegacao = computed(() =>
      temPrefixados() ? 'Passos da inscrição' : 'Seções do formulário',
    );
    this.nomeDaLista = computed(() => (temPrefixados() ? 'passos' : 'seções'));
    this.tituloDoPassoAtual = computed(
      () => navegacao.prefixadoAtual()?.titulo ?? navegacao.passoAtual()?.titulo ?? '',
    );
  }
}

function itensDosPassos(fontes: FontesDoIndicador): StepItem[] {
  const { navegacao } = fontes;
  const comPendencia = fontes.comPendencia();
  const item = (chave: string, rotulo: string, concluido: boolean, comErro: boolean): StepItem => ({
    chave,
    rotulo,
    status: chave === navegacao.chaveAtual() ? 'active' : concluido ? 'done' : 'unvisited',
    concluido,
    comErro,
  });
  return [
    ...fontes
      .passosPrefixados()
      .map((p) => item(p.chave, p.titulo, p.concluido === true, p.comErro === true)),
    ...fontes.passos().map((passo) => {
      // A seção dada como concluída com pendência não passa por pronta: aparece com o estado de erro.
      const pendente = navegacao.mostraPendencia(passo) && comPendencia.has(passo.chave);
      return item(
        passo.chave,
        passo.titulo,
        navegacao.concluido(passo) && !comPendencia.has(passo.chave),
        fontes.comRecusa(passo) || pendente,
      );
    }),
  ];
}
