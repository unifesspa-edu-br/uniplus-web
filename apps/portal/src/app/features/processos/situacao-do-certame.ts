import { type CertameNaVitrineDto, SituacaoDoCertameCodigo } from '@uniplus/shared-data/selecao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';
import { diaNoFuso, formatarDataBr } from '@uniplus/shared-utils';

/** Ordem de exibição dos chips — não é a ordem alfabética do enum gerado. */
export const SITUACOES_EXIBIDAS: readonly SituacaoDoCertameCodigo[] = [
  SituacaoDoCertameCodigo.emBreve,
  SituacaoDoCertameCodigo.inscricoesAbertas,
  SituacaoDoCertameCodigo.ultimosDias,
  SituacaoDoCertameCodigo.encerradas,
];

const VARIANTE: Record<SituacaoDoCertameCodigo, UiTagVariant> = {
  [SituacaoDoCertameCodigo.emBreve]: 'info',
  [SituacaoDoCertameCodigo.inscricoesAbertas]: 'success',
  [SituacaoDoCertameCodigo.ultimosDias]: 'warning',
  [SituacaoDoCertameCodigo.encerradas]: 'neutral',
};

/**
 * Situações em que o certame ainda recebe inscrição — as únicas que o destaque
 * do topo pode convidar a fazer.
 */
const SITUACOES_QUE_RECEBEM_INSCRICAO: readonly SituacaoDoCertameCodigo[] = [
  SituacaoDoCertameCodigo.inscricoesAbertas,
  SituacaoDoCertameCodigo.ultimosDias,
];

export function rotuloDaSituacao(situacao: CertameNaVitrineDto['situacao']): string {
  return situacao.rotulo;
}

export function varianteDaSituacao(situacao: CertameNaVitrineDto['situacao']): UiTagVariant {
  return VARIANTE[situacao.codigo];
}

/** Só o certame que ainda recebe inscrição oferece o botão de inscrever-se. */
export function recebeInscricao(certame: CertameNaVitrineDto): boolean {
  return SITUACOES_QUE_RECEBEM_INSCRICAO.includes(certame.situacao.codigo);
}

export function vagasFormatadas(totalDeVagas: number): string {
  return totalDeVagas.toLocaleString('pt-BR');
}

/**
 * Quando as inscrições de um certame "Em breve" abrem: a data, ou "hoje às HH:mm" se for no dia
 * corrente. O dia civil é o do fuso institucional. Não mostra abertura de certame que já recebe
 * inscrição nem de abertura já passada — nesses casos o que importa é o prazo.
 */
export function aberturaDoCertame(certame: CertameNaVitrineDto, agora: Date): string | null {
  if (certame.situacao.codigo !== SituacaoDoCertameCodigo.emBreve) {
    return null;
  }
  const abertura = new Date(certame.inscricoesDe);
  if (Number.isNaN(abertura.getTime()) || abertura <= agora) {
    return null;
  }
  return diaNoFuso(abertura) === diaNoFuso(agora)
    ? `hoje às ${formatarDataBr(abertura, 'hora')}`
    : formatarDataBr(abertura, 'shortMonth');
}
