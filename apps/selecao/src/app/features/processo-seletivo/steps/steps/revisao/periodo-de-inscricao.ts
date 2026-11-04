import type { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';

import { FaseDoCronograma, WizardDraft } from '../../processo-seletivo.models';
import {
  hojeNoFusoInstitucional,
  instanteDoCampo,
  instanteLegivel,
} from '../../shared/fuso-institucional';

/** Sem catálogo à mão, só o que já foi hidratado do servidor decide — nunca `false` por omissão do parâmetro. */
export const SEM_CATALOGO: ReadonlyMap<string, FaseCanonicaDto> = new Map();

/**
 * Se a fase coleta inscrição: o que ela congelou tem precedência, e o catálogo institucional é o
 * fallback. Uma fase acrescentada nesta sessão nasce com `congelados: null`, e só a hidratação
 * a partir do servidor preenche esse campo; sem o fallback, ela ficaria invisível para a Revisão
 * até um F5, e o comando de publicação mandaria o período onde o servidor exige `null`.
 */
function coletaInscricao(
  fase: FaseDoCronograma,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): boolean {
  return (
    fase.congelados?.coletaInscricao ?? fasePorId.get(fase.faseCanonicaId)?.coletaInscricao ?? false
  );
}

/**
 * A fase que ancora o período de inscrição do Edital: a de menor `ordem` entre as que declaram
 * `coletaInscricao`, como o servidor elege. `null` quando nenhuma fase coleta inscrição pelo
 * sistema, ou seja, o certame é de origem importada.
 *
 * Duas fases de coleta não são problema desta tela: o servidor já elege a de menor `ordem`, e
 * perguntar ao operador qual vale produziria recusa ao enviar o que ele escolhesse.
 */
export function faseQueAncoraOPeriodoDeInscricao(
  draft: WizardDraft,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto> = SEM_CATALOGO,
): FaseDoCronograma | null {
  const fasesDeColeta = draft.cronograma.fases
    .filter((fase) => coletaInscricao(fase, fasePorId))
    .sort((a, b) => a.ordem - b.ordem);
  return fasesDeColeta[0] ?? null;
}

/**
 * Se o período de inscrição vem de uma fase de coleta. Os dois ramos são opostos:
 *
 * - havendo fase de coleta, o servidor deriva a janela dela e recusa qualquer período enviado pela
 *   tela, que então viaja com os dois campos em `null`;
 * - sem fase de coleta, os dois campos são obrigatórios.
 *
 * A tela nunca deriva o período: só decide qual dos dois ramos vale.
 */
export function temFaseDeColetaInscricao(
  draft: WizardDraft,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto> = SEM_CATALOGO,
): boolean {
  return faseQueAncoraOPeriodoDeInscricao(draft, fasePorId) !== null;
}

/**
 * O dia civil, no fuso institucional, que a conformidade legal avalia como `dataReferencia`: o
 * mesmo instante que a publicação usaria como início do período de inscrição. `null` quando esse
 * instante ainda não é conhecido; o checklist legal fica então sem prévia, porque a leitura sem
 * `dataReferencia` avaliaria a referência de hoje, que não é a pergunta feita aqui.
 */
export function dataReferenciaLegalDe(
  draft: WizardDraft,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto> = SEM_CATALOGO,
): string | null {
  const ancora = faseQueAncoraOPeriodoDeInscricao(draft, fasePorId);
  if (ancora !== null) {
    return ancora.inicio === null ? null : hojeNoFusoInstitucional(new Date(ancora.inicio));
  }

  const instante = instanteDoCampo(draft.publicacao.periodoInscricaoInicio);
  return instante === null ? null : hojeNoFusoInstitucional(new Date(instante));
}

/** A fase que ancora o período de inscrição, pelo nome e com a janela dela em data e hora locais. */
export interface JanelaDaInscricao {
  readonly nome: string;
  readonly janela: string | null;
}

export function janelaDaInscricao(
  draft: WizardDraft,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): JanelaDaInscricao | null {
  const fase = faseQueAncoraOPeriodoDeInscricao(draft, fasePorId);
  if (fase === null) return null;

  const nome = fasePorId.get(fase.faseCanonicaId)?.nome ?? 'de inscrição';
  const janela =
    fase.inicio && fase.fim
      ? `${instanteLegivel(fase.inicio)} até ${instanteLegivel(fase.fim)}`
      : null;
  return { nome, janela };
}
