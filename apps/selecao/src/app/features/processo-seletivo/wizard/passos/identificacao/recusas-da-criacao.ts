import {
  paginaDoErro,
  paginaDoProblema,
  type ProblemDetails,
  recusasDoProblema,
} from '@uniplus/shared-core/http';
import type { RecusaDoCampo } from '@uniplus/shared-ui/components';

import {
  ehCausaDoIdentificadorLegivel,
  ehRecusaDoIdentificadorLegivel,
} from '../../shared/identificador-legivel';
import { acrescentarRecusaDoControle } from '../../shared/recusas-por-controle';

/** Os campos do passo que a recusa da criação pode apontar, com o nome que a tela dá a cada um. */
export type CampoDaIdentificacao =
  | 'nome'
  | 'identificadorLegivel'
  | 'unidadeAdministradoraId'
  | 'localidade'
  | 'origemCandidatos';

/** Na ordem em que os campos aparecem na tela: o primeiro recusado recebe o foco. */
export const CAMPOS_NA_ORDEM_DA_TELA: readonly CampoDaIdentificacao[] = [
  'nome',
  'identificadorLegivel',
  'unidadeAdministradoraId',
  'localidade',
  'origemCandidatos',
];

export const ID_DO_CAMPO: Readonly<Record<CampoDaIdentificacao, string>> = {
  nome: 'f-nome',
  identificadorLegivel: 'f-identificador',
  unidadeAdministradoraId: 'f-unidade',
  localidade: 'f-localidade',
  origemCandidatos: 'f-origem',
};

/** O elemento que mostra a recusa do campo e que o campo referencia como descrição. */
export function idDaRecusaDoCampo(campo: CampoDaIdentificacao): string {
  return `${ID_DO_CAMPO[campo]}-erro`;
}

/** Os campos do pedido de criação que a API aponta, na linguagem da tela. */
const CAMPO_DA_TELA: ReadonlyMap<string, CampoDaIdentificacao> = new Map([
  ['nome', 'nome'],
  ['origemCandidatos', 'origemCandidatos'],
  ['unidadeAdministradoraOrigemId', 'unidadeAdministradoraId'],
  ['localidadeCodigoIbge', 'localidade'],
  ['localidadeNome', 'localidade'],
  ['localidadeUf', 'localidade'],
]);

function campoDaTela(causa: {
  readonly field?: string;
  readonly code: string;
}): CampoDaIdentificacao | undefined {
  return ehCausaDoIdentificadorLegivel(causa)
    ? 'identificadorLegivel'
    : CAMPO_DA_TELA.get(causa.field ?? '');
}

interface CausaDaRecusa extends RecusaDoCampo {
  readonly campo?: string;
  readonly ordem: number;
}

/** As causas do problema na ordem recebida, as de campo e as gerais, cada uma com a página do código. */
function causasNaOrdemRecebida(problema: ProblemDetails): readonly CausaDaRecusa[] {
  const causas = problema.errors ?? [];
  const { deCampo, gerais } = recusasDoProblema(problema);
  const daLista = gerais.map((causa) => ({
    codigo: causa.code,
    mensagem: causa.message,
    pagina: paginaDoErro(problema, causa.code),
    ordem: causas.indexOf(causa),
  }));
  return [...deCampo, ...daLista].sort((a, b) => a.ordem - b.ordem);
}

/**
 * As recusas de cada campo do passo, com a mensagem, o código e a página que a API deu a cada
 * uma, em qualquer causa da lista — inclusive a sem `field` cujo código é o do identificador
 * legível, e uma só vez por mensagem e código em cada campo. A causa de outro passo, como o tipo do
 * processo, não entra: aparece só no resumo. Recusa de uma só causa, sem lista, vale pelo código
 * do problema e leva o título.
 */
export function recusasDosCampos(
  problema: ProblemDetails,
  titulo: string,
): ReadonlyMap<CampoDaIdentificacao, readonly RecusaDoCampo[]> {
  return (problema.errors ?? []).length === 0
    ? recusaDeCausaUnica(problema, titulo)
    : recusasDaLista(problema);
}

function recusaDeCausaUnica(problema: ProblemDetails, titulo: string) {
  const recusa = { codigo: problema.code, mensagem: titulo, pagina: paginaDoProblema(problema) };
  return ehRecusaDoIdentificadorLegivel(problema)
    ? new Map<CampoDaIdentificacao, readonly RecusaDoCampo[]>([['identificadorLegivel', [recusa]]])
    : new Map<CampoDaIdentificacao, readonly RecusaDoCampo[]>();
}

function recusasDaLista(problema: ProblemDetails) {
  const porCampo = new Map<CampoDaIdentificacao, RecusaDoCampo[]>();
  for (const causa of causasNaOrdemRecebida(problema)) {
    const campo = campoDaTela({ field: causa.campo, code: causa.codigo });
    if (campo === undefined) continue;
    acrescentarRecusaDoControle(porCampo, campo, {
      codigo: causa.codigo,
      mensagem: causa.mensagem,
      pagina: causa.pagina,
    });
  }
  return porCampo;
}

/**
 * O resumo do passo: a mensagem de cada causa, na ordem recebida, cada uma uma só vez no
 * conjunto — com ou sem campo. Sem lista, o título da recusa.
 */
export function resumoDasRecusas(problema: ProblemDetails, titulo: string): string[] {
  const causas = problema.errors ?? [];
  return causas.length === 0 ? [titulo] : [...new Set(causas.map((causa) => causa.message))];
}
