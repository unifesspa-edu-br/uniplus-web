import type {
  CausaDoEncerramento,
  FiltroDaSituacaoDaProvidencia,
  SituacaoDaProvidencia,
  TipoDaProvidencia,
} from '@uniplus/shared-data/autorizacao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

/** A situação como a tela a mostra: o texto do contrato e a cor da etiqueta. */
export interface SituacaoNaTela {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

const SITUACOES: Readonly<Record<SituacaoDaProvidencia, SituacaoNaTela>> = {
  aberta: { texto: 'Aberta', variante: 'warning' },
  respondida: { texto: 'Respondida', variante: 'info' },
  atendida: { texto: 'Atendida', variante: 'success' },
  prejudicada: { texto: 'Prejudicada', variante: 'neutral' },
};

const TIPOS: Readonly<Record<TipoDaProvidencia, string>> = {
  retirada: 'Retirada do acesso',
  revisao: 'Revisão do acesso',
};

const ENCERRAMENTOS: Readonly<Record<CausaDoEncerramento, string>> = {
  revogada: 'Concessão revogada',
  vencida: 'Concessão vencida',
};

/** Os tipos na ordem em que a solicitação os oferece. */
export const TIPOS_DA_PROVIDENCIA: readonly {
  readonly valor: TipoDaProvidencia;
  readonly rotulo: string;
}[] = (Object.keys(TIPOS) as TipoDaProvidencia[]).map((valor) => ({ valor, rotulo: TIPOS[valor] }));

/** O filtro da fila: as abertas primeiro, que é o padrão, e todas por último. */
export const FILTROS_DA_FILA: readonly {
  readonly valor: FiltroDaSituacaoDaProvidencia;
  readonly rotulo: string;
}[] = [
  ...(Object.keys(SITUACOES) as SituacaoDaProvidencia[]).map((valor) => ({
    valor,
    rotulo: SITUACOES[valor].texto,
  })),
  { valor: 'todas', rotulo: 'Todas' },
];

export function situacaoDaProvidencia(situacao: SituacaoDaProvidencia): SituacaoNaTela {
  return SITUACOES[situacao] ?? { texto: situacao, variante: 'neutral' };
}

export function tipoDaProvidencia(tipo: TipoDaProvidencia): string {
  return TIPOS[tipo] ?? tipo;
}

export function encerramentoDaConcessao(causa: CausaDoEncerramento): string {
  return ENCERRAMENTOS[causa] ?? causa;
}
