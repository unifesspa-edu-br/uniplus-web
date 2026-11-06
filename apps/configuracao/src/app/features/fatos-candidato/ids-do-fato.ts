/** Os ids que o foco procura na edição do fato: a tela e a classe de edição combinam por eles. */
export const ID_DO_SALVAR_DA_DEFINICAO = 'cfg-fato-def-salvar';
export const ID_DAS_CITACOES = 'cfg-fato-def-citacoes';
export const ID_DA_RECUSA_DA_DEFINICAO = 'cfg-fato-def-recusa';
export const ID_DO_FORMULARIO_DA_DEFINICAO = 'cfg-fato-definicao';
export const ID_DO_NOVO_VALOR = 'cfg-fato-novo-valor';
export const ID_DO_TITULO_DA_LISTA = 'cfg-fatos-list-title';
export const ID_DO_CADASTRO = 'cfg-fatos-novo';
export const ID_DO_PONTO_DE_RESOLUCAO_DA_CRIACAO = 'cfg-fato-pontoResolucao';
export const ID_DO_PONTO_DE_RESOLUCAO_DA_DEFINICAO = 'cfg-fato-def-pontoResolucao';
export const ID_DAS_REGRAS_PADRAO = 'cfg-fato-regras';
export const ID_DO_FATO_DE_MEMBRO = 'cfg-fato-fatoDeMembro';

export function idDoValor(codigo: string, parte: string): string {
  return `cfg-fato-valor-${codigo}-${parte}`;
}

export function idDaAcaoDoValor(codigo: string): string {
  return idDoValor(codigo, 'acao');
}
/** O ponto onde o foco recomeça na edição quando o fato volta a ser lido depois de uma falha. */
export const ID_DO_INICIO_DA_EDICAO = 'cfg-fato-edicao-inicio';
export const ID_DAS_REGRAS_DO_DETALHE = 'cfg-fato-detalhe-regras';
