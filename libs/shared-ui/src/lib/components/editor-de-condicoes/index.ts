export { CondicaoDeFatoComponent } from './condicao-de-fato';
export { EditorDeCondicoesComponent } from './editor-de-condicoes';
export * from './motivo-da-protecao-pendente';
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
} from './condicoes/condicoes-em-clausulas';
export {
  type ClausulasNoWire,
  type CondicaoNoWire,
  deClausulasDoWire,
  paraClausulasDoWire,
  predicadoComOperadores,
} from './condicoes/condicoes-no-wire';
export {
  alcanceDaCondicao,
  problemaDaCondicao,
  problemasDeCondicoes,
} from './condicoes/conferencia-da-condicao';
export {
  FONTE_MUNICIPIOS,
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
} from './condicoes/fatos-escolhiveis';
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
} from './condicoes/valor-da-condicao';
export * from './leitura-de-condicoes';
