/**
 * Uma condição de atendimento que o processo oferta, referenciada pelo id do cadastro de
 * Configuração. O `codigo` acompanha o id porque a invariante do PcD (ADR-0067) compara pelo
 * código canônico `PCD`; o `nome` é o que a tela mostra quando a condição já saiu do cadastro ativo.
 */
export interface AtendimentoCondicaoSelecionada {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
}

/**
 * Um recurso de acessibilidade ou tipo de deficiência que o processo oferta, por id do cadastro
 * de Configuração. O `nome` acompanha o id para a referência já removida do cadastro continuar legível.
 */
export interface ReferenciaDeAtendimento {
  readonly id: string;
  readonly nome: string;
}
