import type { TipoDocumentoDto } from '@uniplus/shared-data/configuracao';
import { CLASSIFICACOES_DE_PROTECAO, rotuloDe } from '../../shared/protecao-do-catalogo';

const nomeDoTipo = (tipo: TipoDocumentoDto): string => `o tipo de documento ${tipo.codigo}`;

/** O que a confirmação anuncia: o andamento e a recusa, que só fazem sentido com ela aberta. */
export function anuncioDaConfirmacao(
  tipo: TipoDocumentoDto | null,
  emCurso: boolean,
  motivo: string | null,
  verbos: { readonly andamento: string; readonly recusa: string },
): string {
  if (tipo === null) return '';
  if (emCurso) return `${verbos.andamento} ${nomeDoTipo(tipo)}.`;
  return motivo ? `Não foi possível ${verbos.recusa} ${nomeDoTipo(tipo)}. ${motivo}` : '';
}

export function mensagemDaRemocao(tipo: TipoDocumentoDto | null): string {
  return tipo
    ? `Deseja remover "${tipo.nome}" (${tipo.codigo})? O tipo é removido e mantido na ` +
        'trilha de auditoria. Editais já publicados que o referenciam não são afetados — os ' +
        'parâmetros foram congelados na configuração do edital.'
    : 'Deseja remover este tipo de documento?';
}

export function mensagemDoAceite(
  tipo: TipoDocumentoDto | null,
  recomendada: string | null | undefined,
): string {
  return tipo && recomendada
    ? `Aceitar a classificação "${rotuloDe(CLASSIFICACOES_DE_PROTECAO, recomendada)}" para "${tipo.nome}" (${tipo.codigo})? ` +
        'O tipo fica aprovado com ela, sem nova solicitação, e a proteção de dados é avisada.'
    : 'Aceitar a classificação recomendada pela proteção de dados?';
}
