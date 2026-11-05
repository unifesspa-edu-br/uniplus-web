import {
  BLOCO_REVISAO_E_ACEITE,
  type CampoRenderizavel,
  type FormularioDoCandidato,
  type SecaoRenderizavel,
  type TermoRenderizavel,
  type GrupoRenderizavel,
} from './formulario-do-candidato.model';
import type {
  ItemDasRegras,
  PredicadoDasRegras,
  RegrasDoFormulario,
  SimulacaoDoFormulario,
  ValorJson,
} from './interpretador/regras-do-formulario';

type Comparados = ReadonlyMap<string, readonly ValorJson[]>;

/**
 * A apresentação mínima que as regras permitem: uma seção por etapa, cada campo rotulado pelo próprio
 * código, e o tipo de campo deduzido do que as regras e as respostas dizem dele — oferta, opções
 * permitidas ou opções formadas por outras respostas fazem seleção, faixa faz número, município da
 * UF faz município, condição ou resposta booleana faz sim/não, e a numérica faz número. O que nada
 * indica é texto.
 */
export function apresentacaoDasRegras(
  regras: RegrasDoFormulario,
  simulacao: SimulacaoDoFormulario | null,
): FormularioDoCandidato {
  const respostas = respostasDaSimulacao(simulacao);
  const comparados = valoresDasCondicoes(regras);
  const campo = (item: ItemDasRegras, ordem: number): CampoRenderizavel =>
    campoDoItem(item, ordem, respostas.get(item.fatoCodigo), comparados.get(item.fatoCodigo) ?? []);
  const etapas = regras.etapas ?? [];
  return {
    finalidade: 'SIMULACAO',
    titulo: null,
    etapas: secoesDasRegras(regras),
    fatosColetados: etapas.flatMap((etapa) => etapa.itens ?? []).map(campo),
    grupos: gruposDasRegras(etapas, campo),
    termos: termosDasRegras(regras),
    regras,
  };
}

function gruposDasRegras(
  etapas: NonNullable<RegrasDoFormulario['etapas']>,
  campo: (item: ItemDasRegras, ordem: number) => CampoRenderizavel,
): GrupoRenderizavel[] {
  return etapas
    .flatMap((etapa) => etapa.grupos ?? [])
    .map((grupo, ordem) => ({
      codigo: grupo.codigo,
      ordem,
      rotulo: grupo.codigo,
      minimo: grupo.minimo,
      maximo: grupo.maximo ?? null,
      incluiCandidato: grupo.incluiCandidato,
      subitens: (grupo.subitens ?? []).map(campo),
    }));
}

function termosDasRegras(regras: RegrasDoFormulario): TermoRenderizavel[] {
  return (regras.termos ?? []).map((termo, ordem) => ({
    codigo: termo.codigo,
    codigoNasRegras: termo.codigo,
    ordem,
    nome: termo.codigo,
    texto: '',
    baseLegal: '',
  }));
}

/** As respostas da simulação e, para o fato que só aparece dentro de um grupo, a primeira de uma ocorrência. */
function respostasDaSimulacao(simulacao: SimulacaoDoFormulario | null): Map<string, ValorJson> {
  const respostas = new Map<string, ValorJson>(Object.entries(simulacao?.respostas ?? {}));
  const dosGrupos = Object.values(simulacao?.grupos ?? {}).flatMap((ocorrencias) =>
    (ocorrencias ?? []).flatMap((ocorrencia) => Object.entries(ocorrencia?.respostas ?? {})),
  );
  for (const [fato, valor] of dosGrupos) if (!respostas.has(fato)) respostas.set(fato, valor);
  return respostas;
}

/** Uma seção por etapa e, havendo termos, o bloco de revisão e aceite, que o caso não declara. */
function secoesDasRegras(regras: RegrasDoFormulario): SecaoRenderizavel[] {
  const etapas = regras.etapas ?? [];
  const secoes: SecaoRenderizavel[] = etapas.map((etapa, ordem) => ({
    codigo: etapa.codigo,
    codigoNasRegras: etapa.codigo,
    ordem,
    tipo: 'SECAO',
    titulo: etapa.codigo,
  }));
  if ((regras.termos ?? []).length > 0) {
    secoes.push({
      codigo: BLOCO_REVISAO_E_ACEITE,
      codigoNasRegras: null,
      ordem: etapas.length,
      tipo: 'BLOCO',
      bloco: BLOCO_REVISAO_E_ACEITE,
      titulo: 'Revisão e aceite',
    });
  }
  return secoes;
}

function campoDoItem(
  item: ItemDasRegras,
  ordem: number,
  resposta: ValorJson | undefined,
  comparados: readonly ValorJson[],
): CampoRenderizavel {
  const valores = valoresOferecidos(item);
  return {
    fatoCodigo: item.fatoCodigo,
    ordem,
    rotulo: item.fatoCodigo,
    tipoRenderizacao: tipoDoCampo(item, valores.length > 0, resposta, comparados),
    valoresSelecionaveis:
      valores.length > 0
        ? valores.map((codigo, i) => ({ codigo, descricao: null, ordem: i }))
        : null,
    formato: item.formato ?? null,
  };
}

function valoresOferecidos(item: ItemDasRegras): string[] {
  return [
    ...new Set([
      ...(item.oferta ?? []),
      ...(item.restricoes ?? []).flatMap((r) => (r.entradas ?? []).flatMap((e) => e.valores ?? [])),
    ]),
  ];
}

/** A resposta ou algum valor comparado nas condições é do tipo. */
function indicaTipo(
  tipo: 'boolean' | 'number',
  resposta: ValorJson | undefined,
  comparados: readonly ValorJson[],
): boolean {
  return typeof resposta === tipo || comparados.some((v) => typeof v === tipo);
}

function tipoDoCampo(
  item: ItemDasRegras,
  temValores: boolean,
  resposta: ValorJson | undefined,
  comparados: readonly ValorJson[],
): string {
  const restricoes = item.restricoes ?? [];
  const tem = (tipo: string): boolean => restricoes.some((r) => r.tipo === tipo);
  if (tem('MUNICIPIOS_DA_UF')) return 'MUNICIPIO';
  if (temValores || tem('OPCOES_DAS_RESPOSTAS'))
    return Array.isArray(resposta) ? 'SELECAO_MULTIPLA' : 'SELECAO_UNICA';
  if (indicaTipo('boolean', resposta, comparados)) return 'BOOLEANO';
  if (indicaTipo('number', resposta, comparados) || tem('FAIXA_NUMERICA')) return 'NUMERO';
  return 'TEXTO';
}

/** Os valores com que as condições das regras comparam cada fato. */
function valoresDasCondicoes(regras: RegrasDoFormulario): Comparados {
  const valores = new Map<string, ValorJson[]>();
  for (const predicado of predicadosDasRegras(regras)) {
    for (const clausula of predicado ?? []) {
      for (const condicao of clausula ?? []) {
        if (!condicao) continue;
        valores.set(condicao.fato, [
          ...(valores.get(condicao.fato) ?? []),
          condicao.valor as ValorJson,
        ]);
      }
    }
  }
  return valores;
}

/**
 * As regras já foram conferidas: toda condição — de etapa, item, grupo, termo, opções e derivação — diz
 * com que valor o fato é comparado.
 */
function predicadosDasRegras(regras: RegrasDoFormulario): PredicadoDasRegras[] {
  const etapas = regras.etapas ?? [];
  const grupos = etapas.flatMap((e) => e.grupos ?? []);
  const itens = [
    ...etapas.flatMap((e) => e.itens ?? []),
    ...grupos.flatMap((g) => g.subitens ?? []),
  ];
  return [
    ...etapas.map((etapa) => etapa.exibicao),
    ...[...grupos, ...(regras.termos ?? [])].flatMap((dono) => [
      dono.exibicao,
      dono.predicadoObrigatoriedade,
    ]),
    ...itens.flatMap((item) => [
      item.exibicao,
      item.predicadoObrigatoriedade,
      item.impedimento?.quando,
      ...(item.restricoes ?? []).flatMap((r) => (r.entradas ?? []).map((e) => e.quando)),
    ]),
    ...(regras.derivacoes ?? []).flatMap((d) => (d?.regras ?? []).map((regra) => regra?.quando)),
  ];
}
