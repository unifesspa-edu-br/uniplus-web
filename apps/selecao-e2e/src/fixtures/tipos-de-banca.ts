import type {
  PapelDaBancaCodigo,
  TipoDeBancaCodigo,
  TipoMotivoDeDecisaoCodigo,
  EtapaProcessoDto,
} from '@uniplus/shared-data/selecao';

type BancaLida = EtapaProcessoDto['bancas'][number];

/** O que a banca grava do tipo ao ser criada: o código, o papel, as duas marcas e as decisões que julga. */
export type CopiaDoTipoDeBanca = Pick<
  BancaLida,
  | 'codigo'
  | 'papel'
  | 'exigeDuasOuMaisBancas'
  | 'encerraRecursoNaPrimeiraInstancia'
  | 'tiposDeDecisaoJulgados'
>;

/** O tipo de banca como o cadastro da Configuração o devolve. */
export interface TipoDeBancaDoCatalogo extends CopiaDoTipoDeBanca {
  readonly id: string;
  readonly nome: string;
  readonly faseTipica: string | null;
  readonly descricao: string | null;
  readonly criadoEm: string;
}

const PAPEIS: Readonly<Record<PapelDaBancaCodigo, string>> = {
  AVALIA_O_MERITO: 'Avalia o mérito',
  JULGA_A_PRIMEIRA_INSTANCIA: 'Julga o recurso em 1ª instância',
  IMPORTA_AS_NOTAS_DO_INEP: 'Importa as notas do INEP',
  IMPORTA_CANDIDATOS: 'Importa candidatos',
  JULGA_A_SEGUNDA_INSTANCIA: 'Julga o recurso em 2ª instância',
};

interface DescricaoDoTipo {
  readonly id: string;
  readonly codigo: TipoDeBancaCodigo;
  readonly rotulo: string;
  readonly papel?: PapelDaBancaCodigo;
  readonly marcas?: Partial<
    Pick<CopiaDoTipoDeBanca, 'exigeDuasOuMaisBancas' | 'encerraRecursoNaPrimeiraInstancia'>
  >;
  readonly tiposDeDecisaoJulgados?: CopiaDoTipoDeBanca['tiposDeDecisaoJulgados'];
}

function tipoDeBanca(tipo: DescricaoDoTipo): TipoDeBancaDoCatalogo {
  const papel = tipo.papel ?? ('AVALIA_O_MERITO' as PapelDaBancaCodigo);
  return {
    id: tipo.id,
    codigo: { codigo: tipo.codigo, rotulo: tipo.rotulo },
    nome: tipo.rotulo,
    faseTipica: null,
    descricao: null,
    papel: { codigo: papel, rotulo: PAPEIS[papel] },
    exigeDuasOuMaisBancas: tipo.marcas?.exigeDuasOuMaisBancas ?? false,
    encerraRecursoNaPrimeiraInstancia: tipo.marcas?.encerraRecursoNaPrimeiraInstancia ?? false,
    tiposDeDecisaoJulgados: tipo.tiposDeDecisaoJulgados ?? [],
    criadoEm: '2026-08-30T12:00:00Z',
  };
}

export const ID_DO_TIPO_ENTREVISTA = '01a0d640-0000-7000-8000-0000000000c1';
export const ID_DO_TIPO_ANALISE_DOCUMENTAL = '01a0d640-0000-7000-8000-000000000c01';
export const ID_DO_TIPO_HETEROIDENTIFICACAO = '01a0d640-0000-7000-8000-000000000c02';
export const ID_DO_TIPO_ANALISE_DE_RECURSOS = '01a0d640-0000-7000-8000-000000000c03';
export const ID_DO_TIPO_SEGUNDA_INSTANCIA = '01a0d640-0000-7000-8000-000000000c04';
export const ID_DO_TIPO_HOMOLOGACAO = '01a0d640-0000-7000-8000-000000000c05';
export const ID_DO_TIPO_IMPORTACAO_DAS_NOTAS = '01a0d640-0000-7000-8000-000000000c06';

/**
 * Os tipos de banca do cadastro. A heteroidentificação exige duas ou mais bancas e encerra o
 * recurso na 1ª instância; os demais não trazem marca.
 */
export const TIPOS_DE_BANCA: readonly TipoDeBancaDoCatalogo[] = [
  tipoDeBanca({
    id: ID_DO_TIPO_ENTREVISTA,
    codigo: 'BANCA_ENTREVISTA' as TipoDeBancaCodigo,
    rotulo: 'Banca de entrevista',
  }),
  tipoDeBanca({
    id: ID_DO_TIPO_ANALISE_DOCUMENTAL,
    codigo: 'BANCA_ANALISE_DOCUMENTAL' as TipoDeBancaCodigo,
    rotulo: 'Banca de análise documental',
  }),
  tipoDeBanca({
    id: ID_DO_TIPO_HETEROIDENTIFICACAO,
    codigo: 'BANCA_HETEROIDENTIFICACAO' as TipoDeBancaCodigo,
    rotulo: 'Banca de heteroidentificação',
    marcas: { exigeDuasOuMaisBancas: true, encerraRecursoNaPrimeiraInstancia: true },
    tiposDeDecisaoJulgados: [
      { codigo: 'HETEROIDENTIFICACAO' as TipoMotivoDeDecisaoCodigo, rotulo: 'Heteroidentificação' },
    ],
  }),
  tipoDeBanca({
    id: ID_DO_TIPO_ANALISE_DE_RECURSOS,
    codigo: 'BANCA_ANALISE_RECURSOS' as TipoDeBancaCodigo,
    rotulo: 'Banca de análise de recursos',
    papel: 'JULGA_A_PRIMEIRA_INSTANCIA' as PapelDaBancaCodigo,
  }),
  tipoDeBanca({
    id: ID_DO_TIPO_SEGUNDA_INSTANCIA,
    codigo: 'BANCA_ANALISE_RECURSOS_SEGUNDA_INSTANCIA' as TipoDeBancaCodigo,
    rotulo: 'Banca de análise de recursos de 2ª instância',
    papel: 'JULGA_A_SEGUNDA_INSTANCIA' as PapelDaBancaCodigo,
  }),
  tipoDeBanca({
    id: ID_DO_TIPO_HOMOLOGACAO,
    codigo: 'BANCA_HOMOLOGACAO_INSCRICOES' as TipoDeBancaCodigo,
    rotulo: 'Banca de homologação das inscrições',
  }),
  tipoDeBanca({
    id: ID_DO_TIPO_IMPORTACAO_DAS_NOTAS,
    codigo: 'BANCA_IMPORTACAO_NOTAS_INEP' as TipoDeBancaCodigo,
    rotulo: 'Banca de importação das notas do INEP',
    papel: 'IMPORTA_AS_NOTAS_DO_INEP' as PapelDaBancaCodigo,
  }),
];

/** O cadastro com o nome editável do tipo trocado, sem mexer no código, no rótulo nem nas marcas. */
export function comNomeEditadoNoCadastro(
  catalogo: readonly TipoDeBancaDoCatalogo[],
  id: string,
  nome: string,
): readonly TipoDeBancaDoCatalogo[] {
  return catalogo.map((tipo) => (tipo.id === id ? { ...tipo, nome } : tipo));
}

/** O cadastro com as marcas do tipo trocadas, como depois de a pessoa que o administra editá-lo. */
export function comMarcasNoCadastro(
  catalogo: readonly TipoDeBancaDoCatalogo[],
  id: string,
  marcas: Pick<CopiaDoTipoDeBanca, 'exigeDuasOuMaisBancas' | 'encerraRecursoNaPrimeiraInstancia'>,
): readonly TipoDeBancaDoCatalogo[] {
  return catalogo.map((tipo) => (tipo.id === id ? { ...tipo, ...marcas } : tipo));
}

/** O tipo do catálogo pelo id. */
export function tipoDoCatalogo(id: string): TipoDeBancaDoCatalogo {
  const tipo = TIPOS_DE_BANCA.find((candidato) => candidato.id === id);
  if (!tipo) throw new Error(`O catálogo do cenário não tem o tipo de banca ${id}`);
  return tipo;
}
