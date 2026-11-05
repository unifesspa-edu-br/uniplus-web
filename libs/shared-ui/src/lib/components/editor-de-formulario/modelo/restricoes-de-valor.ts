import {
  FatoDoFormulario,
  ItemDoFormulario,
  LimiteDeDataNoWire,
  OpcaoDoFormulario,
  OpcoesCondicionadas,
  RestricaoDeValor,
} from './tipos';

export const RESTRICAO_FAIXA_NUMERICA = 'FAIXA_NUMERICA';
export const RESTRICAO_TAMANHO_TEXTO = 'TAMANHO_TEXTO';
export const RESTRICAO_OPCOES_PERMITIDAS = 'OPCOES_PERMITIDAS';
export const RESTRICAO_OPCOES_DAS_RESPOSTAS = 'OPCOES_DAS_RESPOSTAS';
export const RESTRICAO_MUNICIPIOS_DA_UF = 'MUNICIPIOS_DA_UF';
export const RESTRICAO_FAIXA_DE_DATA = 'FAIXA_DE_DATA';

export const ANCORA_DATA_FIXA = 'DATA_FIXA';
export const ANCORA_ENVIO = 'ENVIO';

export const RESTRICOES: readonly OpcaoDoFormulario[] = [
  { valor: RESTRICAO_FAIXA_NUMERICA, rotulo: 'Faixa de valores' },
  { valor: RESTRICAO_TAMANHO_TEXTO, rotulo: 'Tamanho do texto' },
  { valor: RESTRICAO_OPCOES_PERMITIDAS, rotulo: 'Opções permitidas' },
  { valor: RESTRICAO_OPCOES_DAS_RESPOSTAS, rotulo: 'Opções das respostas anteriores' },
  { valor: RESTRICAO_MUNICIPIOS_DA_UF, rotulo: 'Municípios da UF respondida' },
  { valor: RESTRICAO_FAIXA_DE_DATA, rotulo: 'Faixa de datas' },
];

/** As casas decimais que a faixa admite: as do edital (`FormaDoItem.CasasDecimaisDaFaixa`). */
export const CASAS_DECIMAIS_DA_FAIXA = 4;
const TIPOS_DE_SELECAO = new Set(['SELECAO_UNICA', 'SELECAO_MULTIPLA']);

/** O tipo de campo a que cada restrição de limite se aplica. */
const CAMPO_DA_RESTRICAO: ReadonlyMap<string, string> = new Map([
  [RESTRICAO_FAIXA_NUMERICA, 'NUMERO'],
  [RESTRICAO_TAMANHO_TEXTO, 'TEXTO'],
  [RESTRICAO_FAIXA_DE_DATA, 'DATA'],
]);

/**
 * As restrições que o administrador pode acrescentar ao campo: a faixa no numérico, o tamanho no de
 * texto e, na seleção, as opções permitidas — quando os valores do domínio são conhecidos, para
 * serem marcados — e as opções das respostas anteriores — quando há campo anterior de onde elas
 * venham. A faixa de datas só no campo de data, como a API confere. Uma por tipo. A do município é posta pela própria tela.
 */
export function restricoesParaAcrescentar(
  item: ItemDoFormulario,
  temValoresConhecidos: boolean,
  temFontesDeOpcoes = false,
): readonly OpcaoDoFormulario[] {
  const presentes = new Set((item.restricoes ?? []).map((restricao) => restricao.tipo));
  const selecao = TIPOS_DE_SELECAO.has(item.tipoRenderizacao);
  const cabe = (tipo: string): boolean => {
    const campo = CAMPO_DA_RESTRICAO.get(tipo);
    if (campo !== undefined) return item.tipoRenderizacao === campo;
    if (tipo === RESTRICAO_OPCOES_PERMITIDAS) return selecao && temValoresConhecidos;
    return tipo === RESTRICAO_OPCOES_DAS_RESPOSTAS && selecao && temFontesDeOpcoes;
  };
  return RESTRICOES.filter((restricao) => cabe(restricao.valor) && !presentes.has(restricao.valor));
}

/** A restrição recém-acrescentada, ainda sem limite nem valor: o problema dela orienta o preenchimento. */
export function restricaoNova(tipo: string): RestricaoDeValor {
  switch (tipo) {
    case RESTRICAO_OPCOES_PERMITIDAS:
      return { tipo, entradas: [entradaDeOpcoesNova()] };
    case RESTRICAO_OPCOES_DAS_RESPOSTAS:
      return { tipo, fatos: [] };
    case RESTRICAO_FAIXA_DE_DATA:
      return { tipo, dataMinima: null, dataMaxima: null };
    default:
      return { tipo, minimo: null, maximo: null };
  }
}

/** O grupo de opções novo: sem condição — vale sempre — e sem valor, que o problema dele pede. */
export function entradaDeOpcoesNova(): OpcoesCondicionadas {
  return { quando: null, valores: [] };
}

/** O limite novo, na âncora escolhida: a data fixa ainda sem data, ou o dia do envio sem deslocamento. */
export function limiteDeDataNovo(ancora: string): LimiteDeDataNoWire {
  return ancora === ANCORA_DATA_FIXA
    ? { ancora, data: null }
    : { ancora: ANCORA_ENVIO, anos: 0, dias: 0 };
}

/**
 * Se toda resposta possível do campo de onde vêm as opções é opção do campo que as recebe
 * (`ConferenciaNoCatalogo.OpcoesDaFonteCabemNoAlvo`): o mesmo domínio e, quando os dois enumeram os
 * valores, os da fonte contidos nos do alvo; quando nenhum enumera, a mesma fonte de valores.
 */
export function opcoesDaFonteCabemNoAlvo(
  alvo: FatoComValores,
  fonte: FatoComValores,
  dominiosDinamicos: ReadonlyMap<string, readonly string[]> = new Map(),
): boolean {
  if (fonte.dominio !== alvo.dominio) return false;
  const daFonte = valoresDoDominio(fonte, dominiosDinamicos);
  const doAlvo = valoresDoDominio(alvo, dominiosDinamicos);
  if (daFonte === null && doAlvo === null)
    return (fonte.fonteValores ?? null) === (alvo.fonteValores ?? null);
  return daFonte !== null && doAlvo !== null && [...daFonte].every((valor) => doAlvo.has(valor));
}

/**
 * Os campos de onde as opções do campo podem vir: os citáveis por ele — anteriores ou conhecidos
 * antes do formulário — cujas opções cabem nas dele, em ordem de nome.
 */
export function fontesDasOpcoes(
  catalogo: readonly FatoDoFormulario[],
  citaveis: ReadonlySet<string>,
  alvoCodigo: string,
): readonly FatoDoFormulario[] {
  const alvo = catalogo.find((fato) => fato.codigo === alvoCodigo);
  if (alvo === undefined) return [];
  return catalogo
    .filter(
      (fato) =>
        fato.codigo !== alvoCodigo &&
        citaveis.has(fato.codigo) &&
        opcoesDaFonteCabemNoAlvo(alvo, fato),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

type FatoComValores = Pick<
  FatoDoFormulario,
  'codigo' | 'dominio' | 'fonteValores' | 'valoresDominio'
>;

/** Os valores enumerados do domínio — do catálogo ou do processo —; nulo no domínio que não os enumera. */
function valoresDoDominio(
  fato: FatoComValores,
  dominiosDinamicos: ReadonlyMap<string, readonly string[]>,
): ReadonlySet<string> | null {
  if ((fato.valoresDominio ?? []).length > 0) return new Set(fato.valoresDominio);
  const dinamicos = dominiosDinamicos.get(fato.codigo);
  return dinamicos === undefined ? null : new Set(dinamicos);
}
