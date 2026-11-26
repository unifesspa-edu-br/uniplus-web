import { AbrangenciaCodigo, type DiaNaoUtilDto } from '@uniplus/shared-data/configuracao';
import type { UiSelectOption } from '@uniplus/shared-ui/components';
import type { VisibilidadeDoDia } from './calendario-mensal.util';
import { municipioLegivel, ufLegivel } from './dia-nao-util-legivel';

/** O que a pessoa escolheu ver. `''` é "todas", como o `ui-select` entrega a opção sem filtro. */
export interface EscolhaDoRecorte {
  readonly abrangencia: string;
  readonly localidade: string;
}

/** O segundo campo, que só existe para as abrangências que têm localidade. */
export interface CampoDaLocalidade {
  readonly rotulo: string;
  readonly todas: string;
}

interface LocalidadeDaAbrangencia extends CampoDaLocalidade {
  readonly valor: (dia: DiaNaoUtilDto) => string | null;
  readonly legivel: (dia: DiaNaoUtilDto) => string;
}

const LOCALIDADES: Partial<Record<string, LocalidadeDaAbrangencia>> = {
  [AbrangenciaCodigo.ESTADUAL]: {
    rotulo: 'Unidade Federativa (UF)',
    todas: 'Todas as UFs',
    valor: (dia) => dia.uf,
    legivel: (dia) => ufLegivel(dia.uf),
  },
  [AbrangenciaCodigo.MUNICIPAL]: {
    rotulo: 'Município',
    todas: 'Todos os municípios',
    valor: (dia) => dia.municipioIbge,
    legivel: municipioLegivel,
  },
};

const ORDEM_DAS_ABRANGENCIAS: readonly string[] = Object.values(AbrangenciaCodigo);

function posicaoDaAbrangencia(codigo: string): number {
  const posicao = ORDEM_DAS_ABRANGENCIAS.indexOf(codigo);
  return posicao === -1 ? ORDEM_DAS_ABRANGENCIAS.length : posicao;
}

/** Uma opção por valor, na ordem de chegada: a primeira ocorrência de cada valor vale. */
function opcoesSemRepeticao(
  dias: readonly DiaNaoUtilDto[],
  valor: (dia: DiaNaoUtilDto) => string | null,
  legivel: (dia: DiaNaoUtilDto) => string,
): UiSelectOption[] {
  const opcoes = new Map<string, string>();
  for (const dia of dias) {
    const chave = valor(dia);
    if (chave && !opcoes.has(chave)) opcoes.set(chave, legivel(dia));
  }
  return [...opcoes].map(([value, label]) => ({ value, label }));
}

/** As abrangências que o dataset tem, com o rótulo que a API mandou, na ordem do domínio. */
export function opcoesDeAbrangencia(dias: readonly DiaNaoUtilDto[]): UiSelectOption[] {
  return opcoesSemRepeticao(
    dias,
    (dia) => dia.abrangencia.codigo,
    (dia) => dia.abrangencia.rotulo,
  ).sort((a, b) => posicaoDaAbrangencia(a.value) - posicaoDaAbrangencia(b.value));
}

export function campoDaLocalidade(abrangencia: string): CampoDaLocalidade | null {
  const localidade = LOCALIDADES[abrangencia];
  return localidade ? { rotulo: localidade.rotulo, todas: localidade.todas } : null;
}

/** As UFs ou os municípios que aparecem nos dias da abrangência escolhida, em ordem alfabética. */
export function opcoesDeLocalidade(
  dias: readonly DiaNaoUtilDto[],
  abrangencia: string,
): UiSelectOption[] {
  const localidade = LOCALIDADES[abrangencia];
  if (!localidade) return [];
  const daAbrangencia = dias.filter((dia) => dia.abrangencia.codigo === abrangencia);
  return opcoesSemRepeticao(daAbrangencia, localidade.valor, localidade.legivel).sort((a, b) =>
    a.label.localeCompare(b.label, 'pt-BR'),
  );
}

/** A escolha que sobrou de uma leitura anterior e já não tem opção nos dias carregados. */
export function escolhaForaDasOpcoes(
  dias: readonly DiaNaoUtilDto[],
  { abrangencia, localidade }: EscolhaDoRecorte,
): boolean {
  if (abrangencia === '') return false;
  const existe = (opcoes: readonly UiSelectOption[], valor: string): boolean =>
    opcoes.some((opcao) => opcao.value === valor);
  const abrangenciaExiste = existe(opcoesDeAbrangencia(dias), abrangencia);
  const localidadeExiste =
    localidade === '' || existe(opcoesDeLocalidade(dias, abrangencia), localidade);
  return !abrangenciaExiste || !localidadeExiste;
}

/** A localidade só restringe os dias da própria abrangência, que é a única que a tem. */
export function visibilidadeDoRecorte({
  abrangencia,
  localidade,
}: EscolhaDoRecorte): VisibilidadeDoDia {
  const valorDaLocalidade = LOCALIDADES[abrangencia]?.valor;
  return (dia) =>
    (abrangencia === '' || dia.abrangencia.codigo === abrangencia) &&
    (localidade === '' || valorDaLocalidade?.(dia) === localidade);
}

export function contagemDoRecorte(visiveis: number, total: number): string {
  const dias = total === 1 ? 'dia não útil' : 'dias não úteis';
  return `Mostrando ${visiveis} de ${total} ${dias}.`;
}

export const AVISO_DO_RECORTE =
  'O filtro só esconde dias da grade: os dias ocultos continuam cadastrados e valendo.';

export const ID_DO_CAMPO_DE_ABRANGENCIA = 'cfg-recorte-abrangencia';

export const LEGENDA_DO_DIA_OCULTO =
  'Os dias com borda tracejada na grade têm dias não úteis ocultos pelo filtro.';

export const AVISO_DO_FILTRO_REMOVIDO =
  'A opção escolhida deixou de existir e o filtro foi removido. Todos os dias estão à mostra.';

/**
 * Ver só os feriados de um município não diz quais dias deixam de ser úteis nele: os nacionais, os
 * estaduais da UF e os institucionais também valem lá. Calcular isso é do cálculo de prazos; aqui o
 * aviso só impede que a grade filtrada seja lida como a lista completa.
 */
export function avisoDoMunicipio(dias: readonly DiaNaoUtilDto[], codigoIbge: string): string {
  const dia = dias.find((candidato) => candidato.municipioIbge === codigoIbge);
  if (!dia) return '';
  const uf = dia.municipioUf ? ` da UF ${dia.municipioUf}` : '';
  return `Em ${municipioLegivel(dia)} também valem os dias nacionais, os estaduais${uf} e os institucionais, que este filtro oculta.`;
}
