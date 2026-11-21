import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { FormGroup } from '@angular/forms';
import type { RecusaDoProblema } from '@uniplus/shared-core/http';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { mesmoConteudo } from '../../../shared/conteudo-canonico';
import { descartarAsRecusasAoSairDoPasso } from '../../../shared/recusas/descarte-das-recusas';
import {
  comEstadoDaConferencia,
  emOrdem,
  primeiraRecusaAtiva,
  type RecusaOrdenada,
} from '../../../shared/recusas/ordem-das-recusas';
import type { CampoDaRecusaDaEtapa } from '../campo-da-etapa';
import { etapaDoFormulario, type EtapaForm } from '../cronograma-form';
import { conteudoDaParteDaEtapa } from '../parte-da-etapa';
import {
  listasDaEtapa,
  type ListasDaEtapa,
  novasPosicoes,
  recusaNasNovasPosicoes,
  todasNoLugar,
} from '../posicao-viva-na-etapa';
import {
  type ControleNaTelaDaEtapa,
  distribuirRecusasDasEtapas,
  type DistribuicaoDasRecusasDasEtapas,
  type EtapasEnviadas,
  type RecusaDaEtapaGuardada,
} from './distribuicao-das-recusas-das-etapas';
import { FormularioDoCronograma } from './formulario-do-cronograma.service';

type GuardadasPorEtapa = ReadonlyMap<FormGroup<EtapaForm>, readonly RecusaDaEtapaGuardada[]>;

/** A recusa que a pessoa ainda precisa tratar, e a etapa a que ela pertence. */
export interface RecusaAtivaNaEtapa {
  readonly grupo: FormGroup<EtapaForm>;
  readonly recusa: RecusaOrdenada;
}

/** A parte da etapa que a recusa aponta já não tem o conteúdo que foi enviado. */
function foiAlterada(grupo: FormGroup<EtapaForm>, recusa: RecusaDaEtapaGuardada): boolean {
  const atual = conteudoDaParteDaEtapa(etapaDoFormulario(grupo), recusa.parte);
  return !mesmoConteudo(atual, recusa.conteudoEnviado);
}

/**
 * O que o servidor recusou na gravação de cada etapa. A recusa fica na etapa que a recebeu, pelo
 * formulário dela, e não na posição: mover ou remover etapas durante a gravação não a leva para
 * outra. Dura até a resposta seguinte da gravação das etapas, até mudar o processo ou sair do
 * passo Cronograma. Alterar a parte do cadastro que ela aponta (a etapa, ou um recurso dela) não
 * a apaga: passa a "a conferir de novo" na hora e assim fica, mesmo que o valor volte ao enviado.
 */
@Injectable()
export class RecusasDoServidorNasEtapas {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cronograma = inject(FormularioDoCronograma);
  private readonly guardadas = signal<GuardadasPorEtapa>(new Map());

  /** As listas de cada etapa na última vez que as recusas foram postas nas posições dos itens. */
  private readonly listasVistas = new WeakMap<FormGroup<EtapaForm>, ListasDaEtapa>();

  private readonly vigentes = computed<
    ReadonlyMap<FormGroup<EtapaForm>, readonly RecusaOrdenada[]>
  >(
    () =>
      new Map(
        [...this.guardadas()].map(([grupo, recusas]) => [
          grupo,
          recusas.map((recusa) => comEstadoDaConferencia(recusa, recusa.alterada)),
        ]),
      ),
  );

  constructor() {
    // O formulário avisa de forma síncrona depois de cada escrita: a alteração conta no ato, e
    // desfazê-la não reativa a recusa.
    this.cronograma.formulario.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.registrarAlteracao());
    descartarAsRecusasAoSairDoPasso(this.store, () => this.limpar());
  }

  /**
   * Substitui as recusas pelas da resposta que acabou de chegar, numerada por `resposta`.
   * Devolve como elas se distribuíram: as que acharam etapa e as que não acharam lugar, estas
   * para o resumo do passo.
   */
  registrar(
    resposta: number,
    enviadas: EtapasEnviadas,
    recusas: readonly RecusaDoProblema[],
    controleNaTela: ControleNaTelaDaEtapa,
  ): DistribuicaoDasRecusasDasEtapas {
    const distribuicao = distribuirRecusasDasEtapas(resposta, enviadas, recusas, controleNaTela);
    this.guardadas.set(distribuicao.porEtapa);
    for (const grupo of distribuicao.porEtapa.keys()) this.vistaDeHoje(grupo);
    this.registrarAlteracao();
    return distribuicao;
  }

  /**
   * Põe cada recusa na posição de hoje do item que ela aponta e esquece a do item que saiu; passa
   * a "a conferir de novo" a recusa da parte que já difere do que foi enviado, e esquece a da
   * etapa que saiu do formulário.
   */
  private registrarAlteracao(): void {
    const noFormulario = new Set(this.cronograma.etapas.controls);
    const antes = this.guardadas();
    const proximas = new Map<FormGroup<EtapaForm>, readonly RecusaDaEtapaGuardada[]>();
    for (const [grupo, recusas] of antes) {
      if (noFormulario.has(grupo))
        proximas.set(grupo, this.comAlteracoes(grupo, this.nasPosicoesDeHoje(grupo, recusas)));
    }
    const mudou =
      proximas.size !== antes.size ||
      [...proximas].some(([grupo, lista]) => lista !== antes.get(grupo));
    if (mudou) this.guardadas.set(proximas);
  }

  /** As listas de hoje da etapa, que passam a ser as vistas; devolve as vistas antes. */
  private vistaDeHoje(grupo: FormGroup<EtapaForm>): ListasDaEtapa {
    const hoje = listasDaEtapa(etapaDoFormulario(grupo));
    const antes = this.listasVistas.get(grupo) ?? hoje;
    this.listasVistas.set(grupo, hoje);
    return antes;
  }

  /**
   * As recusas nas posições que os itens têm hoje. O item é reconhecido por ele mesmo, e não pela
   * posição: remover o recurso 0 leva a recusa do recurso 1 para a posição 0, e a do que saiu
   * deixa de valer. A mesma lista, quando nada mudou de posição.
   */
  private nasPosicoesDeHoje(
    grupo: FormGroup<EtapaForm>,
    recusas: readonly RecusaDaEtapaGuardada[],
  ): readonly RecusaDaEtapaGuardada[] {
    const antes = this.vistaDeHoje(grupo);
    const novas = novasPosicoes(antes, listasDaEtapa(etapaDoFormulario(grupo)));
    if (todasNoLugar(novas)) return recusas;
    return recusas.flatMap((recusa) => recusaNasNovasPosicoes(recusa, novas) ?? []);
  }

  /** As mesmas recusas, na mesma lista, quando nenhuma passou a estar alterada. */
  private comAlteracoes(
    grupo: FormGroup<EtapaForm>,
    recusas: readonly RecusaDaEtapaGuardada[],
  ): readonly RecusaDaEtapaGuardada[] {
    const alteradas = recusas.map((recusa) => recusa.alterada || foiAlterada(grupo, recusa));
    if (alteradas.every((alterada, i) => alterada === recusas[i].alterada)) return recusas;
    return recusas.map((recusa, i) => ({ ...recusa, alterada: alteradas[i] }));
  }

  limpar(): void {
    this.guardadas.set(new Map());
  }

  /** As recusas da etapa a um campo, ativas e a conferir, na ordem em que se leem. */
  recusasDoCampo(
    grupo: FormGroup<EtapaForm>,
    campo: CampoDaRecusaDaEtapa,
  ): readonly RecusaOrdenada[] {
    const daEtapa = this.vigentes().get(grupo) ?? [];
    return emOrdem(daEtapa.filter((recusa) => recusa.campo === campo));
  }

  /** Todas as recusas a um recurso da etapa, ativas e a conferir, na ordem em que se leem. */
  recusasDoRecurso(grupo: FormGroup<EtapaForm>, indice: number): readonly RecusaOrdenada[] {
    const prefixo = `recursos.${indice}.`;
    const daEtapa = this.vigentes().get(grupo) ?? [];
    return emOrdem(daEtapa.filter((recusa) => recusa.campo.startsWith(prefixo)));
  }

  /** A primeira recusa ativa do passo: a da resposta mais recente, na ordem em que a API a deu. */
  primeiraRecusaAtiva(): RecusaAtivaNaEtapa | null {
    const candidatas = [...this.vigentes()].flatMap(([grupo, recusas]) =>
      recusas.map((recusa) => ({ grupo, recusa })),
    );
    return primeiraRecusaAtiva(candidatas);
  }
}
