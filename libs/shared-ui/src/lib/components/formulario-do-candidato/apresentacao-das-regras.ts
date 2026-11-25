import {
  BLOCO_REVISAO_E_ACEITE,
  type CampoApresentado,
  type ColetaDoFormulario,
  type FormularioDoCandidato,
  type PaginaApresentada,
  type TermoApresentado,
  type GrupoApresentado,
  type ValorSelecionavel,
} from './formulario-do-candidato.model';
import type {
  PaginaDasRegras,
  ExibicaoEObrigatoriedadeDasRegras,
  GrupoDasRegras,
  ItemDasRegras,
  PredicadoDasRegras,
  RegrasDoFormulario,
  SimulacaoDoFormulario,
  ValorJson,
} from './interpretador/regras-do-formulario';

type Comparados = ReadonlyMap<string, readonly ValorJson[]>;

/**
 * A apresentação mínima que as regras permitem: uma seção por página, cada campo rotulado pelo próprio
 * código, e o tipo de campo deduzido do que as regras e as respostas dizem dele — oferta, opções
 * permitidas ou opções formadas por outras respostas fazem seleção, faixa faz número, município da
 * UF faz município, condição ou resposta booleana faz sim/não, e a numérica faz número. O que nada
 * indica é texto.
 */
export function apresentacaoDasRegras(
  regras: RegrasDoFormulario,
  simulacao: SimulacaoDoFormulario | null,
): FormularioDoCandidato {
  return {
    finalidade: 'SIMULACAO',
    titulo: null,
    paginas: secoesDasRegras(regras),
    termos: termosDasRegras(regras),
    coleta: coletaDasRegras(regras, fabricaDeCampos(regras, simulacao)),
    regras,
    pressupostos: { fatos: [] },
  };
}

type FabricaDeCampos = (item: ItemDasRegras, ordem: number) => CampoApresentado;

/** O que a simulação e as condições das regras dizem do tipo de um campo. */
interface Indicios {
  readonly resposta: ValorJson | undefined;
  readonly comparados: readonly ValorJson[];
}

function fabricaDeCampos(
  regras: RegrasDoFormulario,
  simulacao: SimulacaoDoFormulario | null,
): FabricaDeCampos {
  const respostas = respostasDaSimulacao(simulacao);
  const comparados = valoresDasCondicoes(regras);
  return (item, ordem) =>
    campoDoItem(item, ordem, {
      resposta: respostas.get(item.fatoCodigo),
      comparados: comparados.get(item.fatoCodigo) ?? [],
    });
}

function coletaDasRegras(regras: RegrasDoFormulario, campo: FabricaDeCampos): ColetaDoFormulario {
  const paginas = regras.paginas ?? [];
  return {
    itens: paginas.flatMap((pagina) => pagina.itens ?? []).map(campo),
    grupos: gruposDasRegras(paginas, campo),
  };
}

function gruposDasRegras(
  paginas: NonNullable<RegrasDoFormulario['paginas']>,
  campo: FabricaDeCampos,
): GrupoApresentado[] {
  return paginas
    .flatMap((pagina) => pagina.grupos ?? [])
    .map((grupo, ordem) => grupoApresentado(grupo, ordem, campo));
}

function grupoApresentado(
  grupo: GrupoDasRegras,
  ordem: number,
  campo: FabricaDeCampos,
): GrupoApresentado {
  return {
    codigo: grupo.codigo,
    ordem,
    rotulo: grupo.codigo,
    ocorrencias: grupo.ocorrencias,
    subitens: (grupo.subitens ?? []).map(campo),
  };
}

function termosDasRegras(regras: RegrasDoFormulario): TermoApresentado[] {
  return (regras.termos ?? []).map((termo, ordem) => ({
    codigo: termo.codigo,
    codigoNasRegras: termo.codigo,
    ordem,
    conteudo: { nome: termo.codigo, texto: '', baseLegal: '' },
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

/** Uma seção por página e, havendo termos, o bloco de revisão e aceite, que o caso não declara. */
function secoesDasRegras(regras: RegrasDoFormulario): PaginaApresentada[] {
  const paginas = regras.paginas ?? [];
  const secoes = paginas.map(secaoDaPagina);
  if ((regras.termos ?? []).length > 0) secoes.push(secaoDeRevisaoEAceite(paginas.length));
  return secoes;
}

function secaoDaPagina(pagina: PaginaDasRegras, ordem: number): PaginaApresentada {
  return {
    codigo: pagina.codigo,
    codigoNasRegras: pagina.codigo,
    ordem,
    tipo: 'SECAO',
    apresentacao: { titulo: pagina.codigo, descricao: null, aviso: null },
  };
}

function secaoDeRevisaoEAceite(ordem: number): PaginaApresentada {
  return {
    codigo: BLOCO_REVISAO_E_ACEITE,
    codigoNasRegras: null,
    ordem,
    tipo: 'BLOCO',
    bloco: BLOCO_REVISAO_E_ACEITE,
    apresentacao: { titulo: 'Revisão e aceite', descricao: null, aviso: null },
  };
}

function campoDoItem(item: ItemDasRegras, ordem: number, indicios: Indicios): CampoApresentado {
  const valores = valoresOferecidos(item);
  return {
    fatoCodigo: item.fatoCodigo,
    ordem,
    apresentacao: {
      rotulo: item.fatoCodigo,
      tipoDeCampo: tipoDoCampo(item, valores.length > 0, indicios),
      ajuda: null,
      pedirConfirmacao: false,
    },
    valoresSelecionaveis: valores.length > 0 ? valoresSelecionaveis(valores) : null,
    formato: item.formato ?? null,
  };
}

function valoresSelecionaveis(codigos: readonly string[]): ValorSelecionavel[] {
  return codigos.map((codigo, i) => ({ codigo, descricao: null, ordem: i }));
}

function valoresOferecidos(item: ItemDasRegras): string[] {
  return [
    ...new Set([
      ...(item.oferta ?? []),
      ...(item.regras.restricoes ?? []).flatMap((r) =>
        (r.entradas ?? []).flatMap((e) => e.valores ?? []),
      ),
    ]),
  ];
}

/** A resposta ou algum valor comparado nas condições é do tipo. */
function indicaTipo(tipo: 'boolean' | 'number', { resposta, comparados }: Indicios): boolean {
  return typeof resposta === tipo || comparados.some((v) => typeof v === tipo);
}

function tipoDoCampo(item: ItemDasRegras, temValores: boolean, indicios: Indicios): string {
  const restricoes = item.regras.restricoes ?? [];
  const tem = (tipo: string): boolean => restricoes.some((r) => r.tipo === tipo);
  if (tem('MUNICIPIOS_DA_UF')) return 'MUNICIPIO';
  if (temValores || tem('OPCOES_DAS_RESPOSTAS'))
    return Array.isArray(indicios.resposta) ? 'ESCOLHA_MULTIPLA' : 'ESCOLHA_UNICA';
  if (indicaTipo('boolean', indicios)) return 'SIM_OU_NAO';
  if (indicaTipo('number', indicios) || tem('FAIXA_NUMERICA')) return 'NUMERO';
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
 * As regras já foram conferidas: toda condição — de página, item, grupo, termo, opções e derivação — diz
 * com que valor o fato é comparado.
 */
function predicadosDasRegras(regras: RegrasDoFormulario): PredicadoDasRegras[] {
  const paginas = regras.paginas ?? [];
  const donos = [...paginas.flatMap((e) => e.grupos ?? []), ...(regras.termos ?? [])];
  return [
    ...paginas.map((pagina) => pagina.exibicao),
    ...donos.flatMap((dono) => predicadosDoElemento(dono.regras)),
    ...itensDasRegras(regras).flatMap(predicadosDoItem),
    ...(regras.derivacoes ?? []).flatMap((d) => (d?.regras ?? []).map((regra) => regra?.quando)),
  ];
}

function predicadosDoElemento(regras: ExibicaoEObrigatoriedadeDasRegras): PredicadoDasRegras[] {
  return [regras.exibicao, regras.obrigatoriedade.predicado];
}

function predicadosDoItem(item: ItemDasRegras): PredicadoDasRegras[] {
  const { regras } = item;
  return [
    ...predicadosDoElemento(regras),
    regras.impedimento?.quando,
    ...(regras.restricoes ?? []).flatMap((r) => (r.entradas ?? []).map((e) => e.quando)),
  ];
}

/** Os campos das páginas e os subitens dos grupos. */
function itensDasRegras(regras: RegrasDoFormulario): ItemDasRegras[] {
  return (regras.paginas ?? []).flatMap((e) => [
    ...(e.itens ?? []),
    ...(e.grupos ?? []).flatMap((g) => g.subitens ?? []),
  ]);
}
