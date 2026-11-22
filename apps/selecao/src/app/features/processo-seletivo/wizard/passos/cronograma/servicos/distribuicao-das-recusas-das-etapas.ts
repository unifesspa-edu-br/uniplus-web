import type { FormGroup } from '@angular/forms';
import type { RecusaDoProblema } from '@uniplus/shared-core/http';

import type { EtapaPontuada } from '../../../processo-seletivo.models';
import { localDaBancaEnviada } from '../../../shared/bancas/campo-da-banca';
import { notaDaBanca } from '../../../shared/bancas/recusas-das-bancas';
import { localDaRecusa, type LocalDaRecusa } from '../../../shared/recusas/local-da-recusa';
import type { RecusaOrdenada } from '../../../shared/recusas/ordem-das-recusas';
import { campoDaRecusaDaEtapa } from '../campo-da-etapa';
import { recursoResolvido } from '../cronograma-para-comando';
import { etapaDoFormulario, type EtapaForm } from '../cronograma-form';
import { conteudoDaParteDaEtapa, parteDaEtapa, type ParteDaEtapa } from '../parte-da-etapa';
import { listasDaEtapa, novasPosicoes, recusaNasNovasPosicoes } from '../posicao-viva-na-etapa';
import type { ConteudoDaGravacao } from './conteudo-da-gravacao';

/**
 * A recusa da gravação, guardada com a parte do cadastro a que pertence e com o que a etapa tinha
 * naquela parte quando foi enviada. `alterada` marca que a pessoa já mexeu na parte: a recusa
 * está a conferir de novo e assim fica, mesmo que o valor volte ao enviado.
 */
export interface RecusaDaEtapaGuardada extends Omit<RecusaOrdenada, 'aConferir'> {
  readonly parte: ParteDaEtapa;
  readonly conteudoEnviado: unknown;
  readonly alterada: boolean;
}

export interface DistribuicaoDasRecusasDasEtapas {
  /** As recusas que acharam lugar, pelo formulário da etapa enviada. */
  readonly porEtapa: ReadonlyMap<FormGroup<EtapaForm>, readonly RecusaDaEtapaGuardada[]>;
  /** As que não nomeiam etapa, nomeiam uma posição que a gravação não enviou ou um campo sem controle na tela. */
  readonly semLugar: readonly RecusaDoProblema[];
}

/** O que foi enviado de cada etapa: o formulário dela e o que ele valia. */
export type EtapasEnviadas = Pick<ConteudoDaGravacao, 'grupos' | 'etapasNoFormulario'>;

/** A etapa tem, na tela, controle para o campo: o que não tem a recusa não pode apontar. */
export type ControleNaTelaDaEtapa = (grupo: FormGroup<EtapaForm>, campo: string) => boolean;

interface LugarNaEtapa {
  readonly parte: ParteDaEtapa;
  readonly grupo: FormGroup<EtapaForm>;
  /** O que a parte valia ao enviar. */
  readonly conteudoEnviado: unknown;
  readonly campo: string;
  readonly nota: string | undefined;
}

/**
 * O `recursos[j]` da resposta conta só os recursos que o comando levou, os de regra resolvida:
 * devolve a posição desse recurso no formulário enviado, ou `null` se não houve tal recurso.
 */
function posicaoDoRecursoEnviado(etapa: EtapaPontuada, enviada: number): number | null {
  const levados = etapa.recursos.flatMap((recurso, i) => (recursoResolvido(recurso) ? [i] : []));
  return levados[enviada] ?? null;
}

/** O lugar da recusa com o recurso na posição que ele tinha no formulário enviado. */
function localNoFormulario(local: LocalDaRecusa, enviada: EtapaPontuada): LocalDaRecusa | null {
  if (local.recurso === null) return local;
  const recurso = posicaoDoRecursoEnviado(enviada, local.recurso);
  return recurso === null ? null : { ...local, recurso };
}

/** O mesmo lugar nas posições de hoje, ou `null` se o item saiu ou a tela não tem controle para ele. */
function naPosicaoDeHoje(
  lugar: LugarNaEtapa,
  enviada: EtapaPontuada,
  controleNaTela: ControleNaTelaDaEtapa,
): LugarNaEtapa | null {
  const hoje = listasDaEtapa(etapaDoFormulario(lugar.grupo));
  const movido = recusaNasNovasPosicoes(lugar, novasPosicoes(listasDaEtapa(enviada), hoje));
  return movido !== null && controleNaTela(lugar.grupo, movido.campo) ? movido : null;
}

/** O lugar da recusa nas posições que os itens e as bancas tinham ao enviar. */
function lugarEnviado(
  local: LocalDaRecusa,
  enviada: EtapaPontuada,
  grupo: FormGroup<EtapaForm>,
): LugarNaEtapa | null {
  const daBanca = localDaBancaEnviada(local, 'bancas', enviada.bancas);
  const campo = campoDaRecusaDaEtapa(daBanca.local);
  if (campo === null) return null;
  const parte = parteDaEtapa(daBanca.local);
  const conteudoEnviado = conteudoDaParteDaEtapa(enviada, parte);
  return { campo, parte, grupo, conteudoEnviado, nota: notaDaBanca(daBanca.bancaAusente) };
}

/**
 * O lugar da recusa na etapa: o campo e a parte pelas posições que os itens tinham ao enviar, e
 * depois pelas de hoje. A banca é a da posição enviada, e a recusa a ela passa a apontar o
 * identificador dela na tela. `null` quando a etapa não conhece o campo, quando o item que a
 * recusa aponta já saiu ou quando a tela não tem controle para ele.
 */
function lugarNaEtapa(
  local: LocalDaRecusa,
  enviada: EtapaPontuada,
  grupo: FormGroup<EtapaForm>,
  controleNaTela: ControleNaTelaDaEtapa,
): LugarNaEtapa | null {
  const doFormulario = localNoFormulario(local, enviada);
  const lugar = doFormulario === null ? null : lugarEnviado(doFormulario, enviada, grupo);
  return lugar === null ? null : naPosicaoDeHoje(lugar, enviada, controleNaTela);
}

/** A etapa enviada que o `field` aponta, ou `null` quando ele não nomeia etapa enviada. */
function lugarDaRecusa(
  recusa: RecusaDoProblema,
  enviadas: EtapasEnviadas,
  controleNaTela: ControleNaTelaDaEtapa,
): LugarNaEtapa | null {
  const local = localDaRecusa(recusa.campo);
  const posicao = local?.dono === 'etapa' ? local.indice : -1;
  const grupo = enviadas.grupos[posicao];
  const enviada = enviadas.etapasNoFormulario[posicao];
  if (local === null || grupo === undefined || enviada === undefined) return null;
  return lugarNaEtapa(local, enviada, grupo, controleNaTela);
}

/**
 * Distribui as recusas de uma resposta pelas etapas enviadas. A posição `etapas[i]` vale para o
 * conteúdo que produziu a resposta, e é nele que ela vira o formulário da etapa: depois da
 * resposta a etapa pode ter mudado de lugar, ou saído. A recusa sem lugar vai para o resumo do
 * passo, e assim nunca some.
 */
export function distribuirRecusasDasEtapas(
  resposta: number,
  enviadas: EtapasEnviadas,
  recusas: readonly RecusaDoProblema[],
  controleNaTela: ControleNaTelaDaEtapa,
): DistribuicaoDasRecusasDasEtapas {
  const porEtapa = new Map<FormGroup<EtapaForm>, RecusaDaEtapaGuardada[]>();
  const semLugar: RecusaDoProblema[] = [];
  for (const recusa of recusas) {
    const lugar = lugarDaRecusa(recusa, enviadas, controleNaTela);
    if (lugar === null) semLugar.push(recusa);
    else acrescentar(porEtapa, lugar.grupo, guardar(recusa, resposta, lugar));
  }
  return { porEtapa, semLugar };
}

function acrescentar(
  porEtapa: Map<FormGroup<EtapaForm>, RecusaDaEtapaGuardada[]>,
  grupo: FormGroup<EtapaForm>,
  guardada: RecusaDaEtapaGuardada,
): void {
  porEtapa.set(grupo, [...(porEtapa.get(grupo) ?? []), guardada]);
}

function guardar(
  recusa: RecusaDoProblema,
  resposta: number,
  { parte, conteudoEnviado, campo, nota }: LugarNaEtapa,
): RecusaDaEtapaGuardada {
  const doLugar = { campo, parte, conteudoEnviado, nota, alterada: false };
  return { ...recusa, ...doLugar, resposta, origem: 'gravacao' };
}
