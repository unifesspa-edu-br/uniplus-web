/** O registro que a escrita em curso afeta e o que a linha dele mostra enquanto isso. */
export interface AndamentoDaEscrita {
  readonly id: string;
  readonly rotulo: string;
}

/** O que a linha mostra por escrita; a tela troca só o verbo que o domínio dela pede. */
export const ROTULOS_PADRAO_DA_ESCRITA = {
  salvando: 'Salvando...',
  removendo: 'Removendo...',
} as const;
