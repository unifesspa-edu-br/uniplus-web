/** O que impede converter o documento para o editor, apontado pelo caminho no documento. */
export interface ImpedimentoDaConversao {
  readonly caminho: string;
  readonly mensagem: string;
}
