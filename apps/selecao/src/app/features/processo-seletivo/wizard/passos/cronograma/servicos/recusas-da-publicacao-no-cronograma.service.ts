import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';

import { descreverFase } from '../../../shared/descricao-da-fase';
import { mesmoConteudo } from '../../../shared/conteudo-canonico';
import {
  chaveDaParteDoLugar,
  conteudoDoLugar,
  lugarDaRecusaDaPublicacao,
  type CronogramaConferido,
  type LugarDaRecusaDaPublicacao,
} from '../../../shared/recusas/lugar-da-recusa-da-publicacao';
import {
  RecusasDaPublicacao,
  type RecusaDaPublicacao,
} from '../../../shared/recusas/recusas-da-publicacao.service';
import type { RecusaOrdenada } from '../../../shared/recusas/ordem-das-recusas';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { campoNaTela, NO_TOPO_DA_FASE } from '../../fase/campo-da-fase';
import { campoNaTelaDaEtapa, NO_TOPO_DA_ETAPA } from '../campo-da-etapa';
import { CatalogoDeFases } from '../catalogos/catalogo-de-fases.service';
import { CatalogoDeTiposDeEtapa } from '../catalogos/catalogo-de-tipos-de-etapa.service';
import {
  campoDoLugar,
  distribuirAsRecusasDaPublicacao,
  type RecusaNoCronograma,
} from './distribuicao-das-recusas-da-publicacao';

const NOTA_DO_RECURSO_REGRAVADO =
  'Sobre um recurso que foi gravado de novo depois desta tentativa de publicação.';

/**
 * As recusas da última publicação no cronograma de hoje, cada uma no lugar que os identificadores
 * dela indicam: a fase pelo código, a etapa e o recurso pelo `Id`. A posição que a API deu nunca
 * escolhe o item, então mudar a ordem das fases ou das etapas não muda o lugar. O item que não
 * existe mais deixa a recusa no topo da etapa (recurso regravado) ou no topo do passo.
 *
 * Alterar a parte do cadastro que a recusa aponta passa a recusa para "a conferir de novo", e
 * assim ela fica mesmo que o valor volte ao que a publicação conferiu. A recusa não sai daqui:
 * quem a retira é a resposta seguinte da publicação.
 */
@Injectable()
export class RecusasDaPublicacaoNoCronograma {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly publicacao = inject(RecusasDaPublicacao);
  private readonly catalogoDeFases = inject(CatalogoDeFases);
  private readonly tiposDeEtapa = inject(CatalogoDeTiposDeEtapa);

  private readonly jaAlteradas = signal<ReadonlySet<string>>(new Set());

  private readonly cronograma = computed<CronogramaConferido>(() => this.store.draft().cronograma);

  private readonly localizadas = computed(() =>
    this.publicacao.recusas().flatMap((recusa) => {
      const lugar = lugarDaRecusaDaPublicacao(recusa, this.cronograma());
      return lugar === null ? [] : [{ recusa, lugar }];
    }),
  );

  /** As partes que hoje diferem do que a publicação conferiu. */
  private readonly alteradas = computed(() => {
    const antes = this.publicacao.cronogramaDaResposta();
    const hoje = this.cronograma();
    const chaves = this.localizadas()
      .filter(({ lugar }) => antes !== null && this.mudou(lugar, antes, hoje))
      .map(({ recusa, lugar }) => this.chave(recusa, lugar));
    return new Set(chaves);
  });

  private readonly distribuicao = computed(() =>
    distribuirAsRecusasDaPublicacao(this.noCronograma()),
  );

  /** Cada recusa localizada, no campo que a tela tem para ela e no estado de hoje. */
  readonly noCronograma = computed<readonly RecusaNoCronograma[]>(() =>
    this.localizadas().map(({ recusa, lugar }) => this.noLugarDeHoje(recusa, lugar)),
  );

  /** As recusas do topo do passo: as que apontam fase ou etapa que não existe mais. */
  readonly doPasso = computed(() => this.distribuicao().doPasso);

  constructor() {
    effect(() => {
      const diferentes = this.alteradas();
      untracked(() => this.lembrar(diferentes));
    });
  }

  /** Todas as recusas da fase, ativas e a conferir, sem ordem. */
  recusasDaFase(faseCanonicaId: string): readonly RecusaOrdenada[] {
    const fase = this.cronograma().fases.find((f) => f.faseCanonicaId === faseCanonicaId);
    return fase === undefined ? [] : (this.distribuicao().porFase.get(fase.codigo) ?? []);
  }

  /** Todas as recusas da etapa, e as dos recursos dela, sem ordem; a etapa nova não tem `Id`. */
  recusasDaEtapa(etapaId: string | null): readonly RecusaOrdenada[] {
    return etapaId === null ? [] : (this.distribuicao().porEtapa.get(etapaId) ?? []);
  }

  /** O lugar de hoje da recusa, para levar a pessoa a ele; `null` quando a recusa não tem lugar. */
  lugarDe(recusa: RecusaDaPublicacao): RecusaNoCronograma | null {
    return (
      this.noCronograma().find(
        (achada) =>
          achada.recusa.resposta === recusa.resposta && achada.recusa.ordem === recusa.ordem,
      ) ?? null
    );
  }

  private chave(recusa: RecusaDaPublicacao, lugar: LugarDaRecusaDaPublicacao): string {
    return `${recusa.resposta}|${chaveDaParteDoLugar(lugar) ?? ''}`;
  }

  private mudou(
    lugar: LugarDaRecusaDaPublicacao,
    antes: CronogramaConferido,
    hoje: CronogramaConferido,
  ): boolean {
    return !mesmoConteudo(conteudoDoLugar(lugar, hoje), conteudoDoLugar(lugar, antes));
  }

  private lembrar(diferentes: ReadonlySet<string>): void {
    const lembradas = this.jaAlteradas();
    if ([...diferentes].every((chave) => lembradas.has(chave))) return;
    this.jaAlteradas.set(new Set([...lembradas, ...diferentes]));
  }

  private noLugarDeHoje(
    recusa: RecusaDaPublicacao,
    lugar: LugarDaRecusaDaPublicacao,
  ): RecusaNoCronograma {
    const doLugar = this.comControleNaTela(lugar);
    const chave = this.chave(recusa, doLugar);
    const regravado = doLugar.tipo === 'recursoRegravado';
    const aConferir = regravado || this.alteradas().has(chave) || this.jaAlteradas().has(chave);
    const nota = regravado ? NOTA_DO_RECURSO_REGRAVADO : undefined;
    return { lugar: doLugar, recusa: { ...recusa, campo: campoDoLugar(doLugar), aConferir, nota } };
  }

  /** O lugar com o campo que a tela tem hoje: sem controle para o campo, a recusa vai ao topo. */
  private comControleNaTela(lugar: LugarDaRecusaDaPublicacao): LugarDaRecusaDaPublicacao {
    if (lugar.tipo === 'fase') {
      return this.controleDaFase(lugar.codigo, lugar.campo)
        ? lugar
        : { ...lugar, campo: NO_TOPO_DA_FASE };
    }
    if (lugar.tipo !== 'etapa') return lugar;
    return this.controleDaEtapa(lugar.etapaId, lugar.campo)
      ? lugar
      : { ...lugar, campo: NO_TOPO_DA_ETAPA };
  }

  private controleDaFase(codigo: string, campo: string): boolean {
    const fase = this.cronograma().fases.find((f) => f.codigo === codigo);
    if (fase === undefined) return false;
    const { exigencias } = descreverFase(fase, this.catalogoDeFases.fasePorId());
    return campoNaTela(campo, exigencias);
  }

  private controleDaEtapa(etapaId: string, campo: string): boolean {
    const etapa = this.cronograma().etapas.find((e) => e.id === etapaId);
    if (etapa === undefined) return false;
    return campoNaTelaDaEtapa(
      campo,
      etapa,
      this.tiposDeEtapa.tipoEtapaPorId().get(etapa.tipoEtapaOrigemId),
    );
  }
}
