export { EditorDeFormularioComponent } from '../../src/lib/components/editor-de-formulario/editor-de-formulario';
export {
  ehColetavel,
  fatosDeMembroParaAcrescentar,
  fatosParaAcrescentar,
  pressupostosParaAcrescentar,
  renderizacaoDe,
} from '../../src/lib/components/editor-de-formulario/modelo/catalogo-de-campos';
export {
  comFatosConhecidosAntes,
  fatosCitadosPeloConteudo,
  fatosCitaveisPelaSecao,
  fatosCitaveisPeloItem,
  fatosCitaveisPelosTermos,
  fatosOferecidos,
  fatosQueExigemResposta,
  predicadosSobreRespostasAnteriores,
  todosOsCampos,
} from '../../src/lib/components/editor-de-formulario/modelo/citacoes';
export {
  BLOCOS,
  BLOCO_COMPROVACAO_DOCUMENTAL,
  BLOCO_MODALIDADES_CALCULADAS,
  BLOCO_REVISAO_E_ACEITE,
  FINALIDADES,
  FINALIDADE_INSCRICAO,
  LIMITES_DO_FORMULARIO,
  OBRIGATORIEDADES,
  OBRIGATORIEDADE_NUNCA,
  OBRIGATORIEDADE_QUANDO,
  OBRIGATORIEDADE_SEMPRE,
  SECAO_DADOS_BASICOS,
  TIPO_BLOCO,
  TIPO_SECAO,
  blocosAdmitidos,
  conteudoInicial,
} from '../../src/lib/components/editor-de-formulario/modelo/constantes';
export {
  conteudoParaEnvio,
  numeroDigitadoInvalido,
  semDadosBasicos,
} from '../../src/lib/components/editor-de-formulario/modelo/envio';
export {
  FATO_PARENTESCO,
  MAXIMO_DE_CAMPOS_DO_GRUPO,
  PROPRIO_CANDIDATO,
  acrescentarCampoAoGrupo,
  camposDoGrupo,
  comCampoDoGrupo,
  comGrupo,
  fatosCitaveisPeloCampoDoGrupo,
  fatosCitaveisPeloGrupo,
  motivoDaRemocaoTravadaDoGrupo,
  moverCampoNoGrupo,
  quantidadeNoTeto,
  removerCampoDoGrupo,
  removerGrupo,
} from '../../src/lib/components/editor-de-formulario/modelo/grupos';
export {
  alternativaSemOProprioCampo,
  comImpedimento,
  impedimentoCabe,
} from '../../src/lib/components/editor-de-formulario/modelo/impedimento';
export {
  acrescentarItem,
  comItem,
  moverEntrada,
  moverItem,
  podeMoverEntrada,
  podeMoverItem,
  removerItem,
  ufsAnteriores,
} from '../../src/lib/components/editor-de-formulario/modelo/itens';
export {
  entradasDaSecao,
  etapasEmOrdem,
  renumerar,
} from '../../src/lib/components/editor-de-formulario/modelo/ordem-das-entradas';
export {
  acrescentarPressuposto,
  removerPressuposto,
} from '../../src/lib/components/editor-de-formulario/modelo/pressupostos';
export {
  problemaDaRestricao,
  problemaDoGrupoDeOpcoes,
  problemaDoLimiteDeData,
  problemaDosAnos,
  problemaDosDias,
} from '../../src/lib/components/editor-de-formulario/modelo/problemas-da-restricao';
export {
  type RecusaDaRestricao,
  type RecusasDoConteudo,
  distribuirRecusas,
  recusasDaRestricao,
  recusasDoGrupoDeOpcoes,
} from '../../src/lib/components/editor-de-formulario/modelo/recusas';
export {
  ANCORA_DATA_FIXA,
  ANCORA_ENVIO,
  RESTRICAO_FAIXA_DE_DATA,
  RESTRICAO_FAIXA_NUMERICA,
  RESTRICAO_MUNICIPIOS_DA_UF,
  RESTRICAO_OPCOES_DAS_RESPOSTAS,
  RESTRICAO_OPCOES_PERMITIDAS,
  RESTRICAO_TAMANHO_TEXTO,
  RESTRICOES,
  entradaDeOpcoesNova,
  fontesDasOpcoes,
  limiteDeDataNovo,
  opcoesDaFonteCabemNoAlvo,
  restricaoNova,
  restricoesParaAcrescentar,
} from '../../src/lib/components/editor-de-formulario/modelo/restricoes-de-valor';
export {
  acrescentarBloco,
  acrescentarSecao,
  comEtapa,
  etapaFixa,
  moverEtapa,
  podeMoverEtapa,
  removerEtapa,
} from '../../src/lib/components/editor-de-formulario/modelo/secoes';
export {
  acrescentarTermo,
  comTermo,
  moverTermo,
  removerTermo,
  termosEmOrdem,
  termosParaAcrescentar,
} from '../../src/lib/components/editor-de-formulario/modelo/termos';
export {
  type ChaveDaEntrada,
  type ConteudoDoFormulario,
  ESCOPO_CANDIDATO,
  ESCOPO_MEMBRO,
  type EntradaDaSecao,
  type EscopoDoCampo,
  type EtapaDoFormulario,
  type FatoDoFormulario,
  type GrupoDoFormulario,
  type Impedimento,
  type ItemDoFormulario,
  type LimiteDeDataNoWire,
  type NumeroDigitado,
  type OpcaoDoFormulario,
  type OpcoesCondicionadas,
  type PredicadoNoWire,
  type RestricaoDeValor,
  type ResultadoDaEdicao,
  type ResultadoDoGrupo,
  type TermoDisponivel,
  type TermoDoFormulario,
} from '../../src/lib/components/editor-de-formulario/modelo/tipos';
export * from '../../src/lib/components/editor-de-formulario/termos-disponiveis';
