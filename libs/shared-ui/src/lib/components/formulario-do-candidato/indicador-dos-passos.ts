import { computed } from '@angular/core';

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
  private readonly temPrefixados = computed(() => this.fontes.passosPrefixados().length > 0);
  readonly itens = computed(() => itensDosPassos(this.fontes));
  readonly progresso = computed(
    () =>
      (this.itens().filter((item) => item.concluido === true).length /
        this.fontes.navegacao.total()) *
      100,
  );
  readonly posicao = computed(
    () =>
      `${this.temPrefixados() ? 'Passo' : 'Seção'} ${this.fontes.navegacao.indice() + 1} de ${this.fontes.navegacao.total()}`,
  );
  readonly rotuloDoAnterior = computed(() => {
    const prefixados = this.fontes.passosPrefixados().length;
    return prefixados > 0 && this.fontes.navegacao.indice() <= prefixados
      ? 'Passo anterior'
      : 'Seção anterior';
  });
  readonly rotuloDoProximo = computed(() =>
    this.fontes.navegacao.passoAtual() ? 'Próxima seção' : 'Próximo passo',
  );
  readonly rotuloDaNavegacao = computed(() =>
    this.temPrefixados() ? 'Passos da inscrição' : 'Seções do formulário',
  );
  readonly nomeDaLista = computed(() => (this.temPrefixados() ? 'passos' : 'seções'));
  readonly tituloDoPassoAtual = computed(
    () =>
      this.fontes.navegacao.prefixadoAtual()?.titulo ??
      this.fontes.navegacao.passoAtual()?.titulo ??
      '',
  );

  constructor(private readonly fontes: FontesDoIndicador) {}
}

type PassoNoIndicador = Omit<StepItem, 'status'>;

function estadoDoPrefixado(passo: PassoPrefixado): PassoNoIndicador {
  return {
    chave: passo.chave,
    rotulo: passo.titulo,
    concluido: passo.concluido === true,
    comErro: passo.comErro === true,
  };
}

function estadoDaSecao(
  passo: PassoDoFormulario,
  fontes: FontesDoIndicador,
  comPendencia: ReadonlySet<string>,
): PassoNoIndicador {
  const pendente = fontes.navegacao.mostraPendencia(passo) && comPendencia.has(passo.chave);
  return {
    chave: passo.chave,
    rotulo: passo.titulo,
    concluido: fontes.navegacao.concluido(passo) && !comPendencia.has(passo.chave),
    comErro: fontes.comRecusa(passo) || pendente,
  };
}

function itemNoIndicador(passo: PassoNoIndicador, chaveAtual: string | null): StepItem {
  return {
    ...passo,
    status: passo.chave === chaveAtual ? 'active' : passo.concluido ? 'done' : 'unvisited',
  };
}

function itensDosPassos(fontes: FontesDoIndicador): StepItem[] {
  const comPendencia = fontes.comPendencia();
  const passos = [
    ...fontes.passosPrefixados().map(estadoDoPrefixado),
    ...fontes.passos().map((passo) => estadoDaSecao(passo, fontes, comPendencia)),
  ];
  return passos.map((passo) => itemNoIndicador(passo, fontes.navegacao.chaveAtual()));
}
