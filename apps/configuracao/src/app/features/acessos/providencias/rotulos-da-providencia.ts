import { SituacaoDaProvidenciaCodigo, TipoDaProvidencia } from '@uniplus/shared-data/autorizacao';
import type { VariantesDosCodigos } from '@uniplus/shared-ui/components';

/** A cor da etiqueta da situação; o texto vem do rótulo que a API devolve. */
export const VARIANTES_DA_SITUACAO: VariantesDosCodigos<SituacaoDaProvidenciaCodigo> = {
  [SituacaoDaProvidenciaCodigo.ABERTA]: 'warning',
  [SituacaoDaProvidenciaCodigo.RESPONDIDA]: 'info',
  [SituacaoDaProvidenciaCodigo.ATENDIDA]: 'success',
  [SituacaoDaProvidenciaCodigo.PREJUDICADA]: 'neutral',
};

/** As opções de entrada da tela: a resposta da API só traz o rótulo do valor que ela devolve. */
const OPCOES_DE_SITUACAO: Readonly<Record<SituacaoDaProvidenciaCodigo, string>> = {
  [SituacaoDaProvidenciaCodigo.ABERTA]: 'Aberta',
  [SituacaoDaProvidenciaCodigo.RESPONDIDA]: 'Respondida',
  [SituacaoDaProvidenciaCodigo.ATENDIDA]: 'Atendida',
  [SituacaoDaProvidenciaCodigo.PREJUDICADA]: 'Prejudicada',
};

const OPCOES_DE_TIPO: Readonly<Record<TipoDaProvidencia, string>> = {
  [TipoDaProvidencia.RETIRADA]: 'Retirada do acesso',
  [TipoDaProvidencia.REVISAO]: 'Revisão do acesso',
};

/** Os tipos na ordem em que a solicitação os oferece. */
export const TIPOS_DA_PROVIDENCIA: readonly {
  readonly valor: TipoDaProvidencia;
  readonly rotulo: string;
}[] = (Object.keys(OPCOES_DE_TIPO) as TipoDaProvidencia[]).map((valor) => ({
  valor,
  rotulo: OPCOES_DE_TIPO[valor],
}));

export const FILTROS_DA_FILA: readonly {
  readonly valor: SituacaoDaProvidenciaCodigo | 'todas';
  readonly rotulo: string;
}[] = [
  ...Object.values(SituacaoDaProvidenciaCodigo).map((valor) => ({
    valor,
    rotulo: OPCOES_DE_SITUACAO[valor],
  })),
  { valor: 'todas', rotulo: 'Todas' },
];
