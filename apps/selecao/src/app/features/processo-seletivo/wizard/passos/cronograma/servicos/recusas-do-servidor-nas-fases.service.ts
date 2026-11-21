import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { RecusaDoProblema } from '@uniplus/shared-core/http';

import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { mesmoConteudo } from '../../../shared/conteudo-canonico';
import { emOrdem, type RecusaOrdenada } from '../../../shared/recusas/ordem-das-recusas';
import type { CampoDaRecusaDaFase } from '../../fase/campo-da-fase';
import { faseComoNoFormulario } from '../cronograma-form';
import { conteudoDaParte, type ParteDaFase } from '../../fase/parte-da-fase';
import {
  type ControleNaTela,
  distribuirRecusasDasFases,
  type DistribuicaoDasRecusas,
  type RecusaDaFaseGuardada,
} from './distribuicao-das-recusas-das-fases';

/** A recusa que a pessoa ainda precisa tratar, e a fase a que ela pertence. */
export interface RecusaAtivaNaFase {
  readonly faseCanonicaId: string;
  readonly recusa: RecusaOrdenada;
}

/** A parte de uma fase, como chave do que já foi alterado. */
function chaveDaParte(faseCanonicaId: string, parte: ParteDaFase): string {
  return `${faseCanonicaId}|${parte}`;
}

function comEstado(guardada: RecusaDaFaseGuardada, aConferir: boolean): RecusaOrdenada {
  const { campo, codigo, mensagem, pagina, ordem, resposta, origem } = guardada;
  return { campo, codigo, mensagem, pagina, ordem, resposta, origem, aConferir };
}


/**
 * As fases do rascunho como o formulário as envia: o rascunho que chega do servidor pode trazer a
 * janela em outro formato ou omitir campos opcionais, e comparado cru com o que a gravação enviou
 * faria toda recusa nascer "a conferir de novo", sem que ninguém tivesse alterado a fase.
 */
function comoMapaPorId(fases: readonly FaseDoCronograma[]): ReadonlyMap<string, FaseDoCronograma> {
  return new Map(fases.map((fase) => [fase.faseCanonicaId, faseComoNoFormulario(fase)] as const));
}

/** As partes das fases recusadas que hoje diferem do que a gravação enviou. */
function partesQueDiferem(
  guardadas: ReadonlyMap<string, readonly RecusaDaFaseGuardada[]>,
  atuais: ReadonlyMap<string, FaseDoCronograma>,
): string[] {
  return [...guardadas].flatMap(([id, recusas]) => {
    const atual = atuais.get(id);
    if (atual === undefined) return [];
    return recusas
      .filter((r) => !mesmoConteudo(conteudoDaParte(atual, r.parte), r.conteudoEnviado))
      .map((r) => chaveDaParte(id, r.parte));
  });
}

/**
 * O que o servidor recusou na gravação de cada fase. A recusa fica na fase que a recebeu, pelo
 * identificador dela, e não na posição: mover ou remover fases durante a gravação não a leva
 * para outra. Dura até a resposta seguinte da gravação das fases, aceita ou recusada, ou até
 * mudar o processo ou sair do passo Cronograma; alterar a parte do cadastro que ela aponta não a apaga, passa a "a conferir
 * de novo" e assim fica, mesmo que o valor volte ao que foi enviado.
 */
@Injectable()
export class RecusasDoServidorNasFases {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly guardadas = signal<ReadonlyMap<string, readonly RecusaDaFaseGuardada[]>>(
    new Map(),
  );

  private readonly fasesPorId = computed(() => comoMapaPorId(this.store.draft().cronograma.fases));

  /**
   * As partes que já foram alteradas depois da resposta, mesmo que o valor tenha voltado ao
   * enviado: quem alterou e desfez ainda não viu o servidor conferir a parte de novo.
   */
  private readonly jaAlteradas = signal<ReadonlySet<string>>(new Set());

  private readonly vigentes = computed<ReadonlyMap<string, readonly RecusaOrdenada[]>>(() => {
    const atuais = this.fasesPorId();
    const alteradas = new Set([
      ...this.jaAlteradas(),
      ...partesQueDiferem(this.guardadas(), atuais),
    ]);
    return new Map(
      [...this.guardadas()].flatMap(([id, recusas]) => {
        if (!atuais.has(id)) return [];
        return [
          [id, recusas.map((r) => comEstado(r, alteradas.has(chaveDaParte(id, r.parte))))] as const,
        ];
      }),
    );
  });

  constructor() {
    effect(() => {
      this.store.geracao();
      untracked(() => this.limpar());
    });
    // A página mantém o passo montado e só o esconde: sair do passo é que descarta as recusas.
    effect(() => {
      if (!this.store.cronogramaVisivel()) untracked(() => this.limpar());
    });
  }

  /**
   * Avisa que o rascunho acabou de ser escrito. A parte que difere do que foi enviado
   * passa a "a conferir de novo" na hora, e assim fica até a resposta seguinte: quem escreve o
   * rascunho avisa depois de cada escrita, então alterar e desfazer não a reativa.
   */
  registrarAlteracao(): void {
    const diferentes = partesQueDiferem(this.guardadas(), this.fasesPorId());
    const antes = this.jaAlteradas();
    if (diferentes.every((chave) => antes.has(chave))) return;
    this.jaAlteradas.set(new Set([...antes, ...diferentes]));
  }

  /**
   * Substitui as recusas pelas da resposta que acabou de chegar, numerada por `resposta`.
   * Devolve como elas se distribuíram: as que acharam fase e as que não acharam lugar, estas
   * para o resumo do passo.
   */
  registrar(
    resposta: number,
    enviadas: readonly FaseDoCronograma[],
    recusas: readonly RecusaDoProblema[],
    controleNaTela: ControleNaTela,
  ): DistribuicaoDasRecusas {
    const distribuicao = distribuirRecusasDasFases(resposta, enviadas, recusas, controleNaTela);
    this.jaAlteradas.set(new Set());
    this.guardadas.set(distribuicao.porFase);
    this.registrarAlteracao();
    return distribuicao;
  }

  limpar(): void {
    this.jaAlteradas.set(new Set());
    this.guardadas.set(new Map());
  }

  /** Todas as recusas da fase, ativas e a conferir, sem ordem. */
  recusasDaFase(faseCanonicaId: string): readonly RecusaOrdenada[] {
    return this.vigentes().get(faseCanonicaId) ?? [];
  }

  /** As recusas da fase a um campo, na ordem em que se leem. */
  recusasDoCampo(faseCanonicaId: string, campo: CampoDaRecusaDaFase): readonly RecusaOrdenada[] {
    return emOrdem(this.recusasDaFase(faseCanonicaId).filter((recusa) => recusa.campo === campo));
  }

  /** A primeira recusa ativa do passo: a da resposta mais recente, na ordem em que a API a deu. */
  primeiraRecusaAtiva(): RecusaAtivaNaFase | null {
    const ativas = [...this.vigentes()].flatMap(([faseCanonicaId, recusas]) =>
      recusas.filter((r) => !r.aConferir).map((recusa) => ({ faseCanonicaId, recusa })),
    );
    const primeira = ativas.sort(
      (a, b) => b.recusa.resposta - a.recusa.resposta || a.recusa.ordem - b.recusa.ordem,
    )[0];
    return primeira ?? null;
  }
}
