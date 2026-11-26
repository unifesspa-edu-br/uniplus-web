import { TipoDeCondicaoDeHomologacaoCodigo } from '@uniplus/shared-data/selecao';

/**
 * Como cada tipo de condição aparece para a pessoa. A API devolve só o código; o texto é o do
 * contrato e, por ser um registro completo sobre o enum gerado, o tipo novo que a API acrescentar
 * quebra a compilação até ganhar o rótulo.
 */
const ROTULOS: Readonly<Record<TipoDeCondicaoDeHomologacaoCodigo, string>> = {
  [TipoDeCondicaoDeHomologacaoCodigo.RESULTADO_NO_RETORNO_DO_INEP]: 'Resultado no retorno do INEP',
};

export interface OpcaoDeTipoDeCondicao {
  readonly valor: string;
  readonly rotulo: string;
}

/** Os tipos que a API aceita, na ordem do contrato, para a pessoa escolher. */
export const TIPOS_DE_CONDICAO_DE_HOMOLOGACAO: readonly OpcaoDeTipoDeCondicao[] = Object.values(
  TipoDeCondicaoDeHomologacaoCodigo,
).map((tipo) => ({ valor: tipo, rotulo: ROTULOS[tipo] }));

/** O rótulo do tipo; o código que este cliente não conhece aparece como veio, sem esconder a regra. */
export function rotuloDoTipoDeCondicao(tipo: string): string {
  return TIPOS_DE_CONDICAO_DE_HOMOLOGACAO.find((opcao) => opcao.valor === tipo)?.rotulo ?? tipo;
}
