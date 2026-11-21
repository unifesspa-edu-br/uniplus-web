export { CondicaoDeFatoComponent } from '../../src/lib/components/editor-de-condicoes/condicao-de-fato';
export { EditorDeCondicoesComponent } from '../../src/lib/components/editor-de-condicoes/editor-de-condicoes';
export * from '../../src/lib/components/editor-de-condicoes/motivo-da-protecao-pendente';
export {
  type ClausulaDeCondicoes,
  type CondicaoEmClausula,
  type CondicaoPosicionada,
  clausulasDe,
  comClausulaEm,
  comCondicaoEm,
  comCondicaoTrocadaEm,
  condicaoNova,
  numerosDeClausula,
  renumerarClausulas,
  semClausulaEm,
  semCondicaoEm,
} from '../../src/lib/components/editor-de-condicoes/condicoes/condicoes-em-clausulas';
export {
  type ClausulasNoWire,
  type CondicaoNoWire,
  deClausulasDoWire,
  paraClausulasDoWire,
  predicadoComOperadores,
} from '../../src/lib/components/editor-de-condicoes/condicoes/condicoes-no-wire';
export {
  alcanceDaCondicao,
  problemaDaCondicao,
  problemasDeCondicoes,
} from '../../src/lib/components/editor-de-condicoes/condicoes/conferencia-da-condicao';
export {
  FONTE_GEO_MUNICIPIO,
  type FatoDoCatalogo,
  type FatoEscolhivel,
  type TipoDeDominio,
  type ValorDoCatalogo,
  fatoEscolhivel,
  fatosEscolhiveis,
  nomesDoCatalogo,
  operadorPadrao,
  rotuloDoOperador,
  rotuloDoValor,
} from '../../src/lib/components/editor-de-condicoes/condicoes/fatos-escolhiveis';
export {
  type CondicaoDeFato,
  type OpcaoDeValor,
  RESPOSTAS_BOOLEANAS,
  VALOR_FALSO,
  VALOR_VERDADEIRO,
  comOperador,
  comValorEscalar,
  comValoresDeLista,
  valorEscalarDe,
  valoresDeListaDe,
} from '../../src/lib/components/editor-de-condicoes/condicoes/valor-da-condicao';
export {
  comparaComLista,
  ehNegacao,
} from '../../src/lib/components/formulario-do-candidato/interpretador/predicado';
export * from '../../src/lib/components/editor-de-condicoes/leitura-de-condicoes';

export {
  BUSCA_DE_MUNICIPIOS,
  ESPERA_DA_DIGITACAO_MS,
  LEITURA_DE_MUNICIPIO_POR_CODIGO,
  NomesDeMunicipios,
  type BuscaDeMunicipios,
  type LeituraDeMunicipio,
  type MunicipioEncontrado,
} from '../../src/lib/components/editor-de-condicoes/valor-de-municipio';
