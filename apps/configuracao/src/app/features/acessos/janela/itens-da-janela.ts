import {
  ResultadoDaMigracao,
  SituacaoDaConcessaoNaRevisaoCodigo,
  SituacaoDaRevisaoDasConcessoesCodigo,
} from '@uniplus/shared-data/autorizacao';
import type {
  DecisaoDaMigracao,
  ItemDaJanelaDto,
  JanelaDeMigracaoDto,
} from '@uniplus/shared-data/autorizacao';

/** O que cada pessoa decide, por concessão. */
export type DecisoesDaMigracao = ReadonlyMap<string, DecisaoDaMigracao>;

/** As concessões da revisão, separadas pelo que a pessoa que lê pode fazer com cada uma. */
export interface ItensDaJanela {
  /** Aguardam a decisão da gestão de acessos e não são da pessoa que lê. */
  readonly aguardandoDecisao: readonly ItemDaJanelaDto[];
  /** O envio das decisões as reteve para outra pessoa da gestão de acessos decidir. */
  readonly retidas: readonly ItemDaJanelaDto[];
  /** Migram só depois da decisão do Representante do controlador. */
  readonly naProtecaoDeDados: readonly ItemDaJanelaDto[];
  /** São da pessoa que lê e ainda aguardam decisão: outra pessoa decide, e a tela não oferece ação. */
  readonly proprias: readonly ItemDaJanelaDto[];
  /** Têm situação final, ou a revisão já não aceita decisão. */
  readonly decididas: readonly ItemDaJanelaDto[];
}

type GrupoComAcao = 'aguardandoDecisao' | 'retidas' | 'naProtecaoDeDados';

const GRUPO_DA_SITUACAO: Readonly<
  Partial<Record<SituacaoDaConcessaoNaRevisaoCodigo, GrupoComAcao>>
> = {
  [SituacaoDaConcessaoNaRevisaoCodigo.AGUARDANDO_DECISOES]: 'aguardandoDecisao',
  [SituacaoDaConcessaoNaRevisaoCodigo.RETIDA]: 'retidas',
  [SituacaoDaConcessaoNaRevisaoCodigo.AGUARDANDO_PROTECAO_DE_DADOS]: 'naProtecaoDeDados',
};

/** A revisão aceita decisão enquanto está aberta; encerrando ou encerrada, só mostra a situação final. */
export function janelaAceitaDecisao(revisao: Pick<JanelaDeMigracaoDto, 'situacao'>): boolean {
  return revisao.situacao.codigo === SituacaoDaRevisaoDasConcessoesCodigo.ABERTA;
}

export function separarItens(revisao: JanelaDeMigracaoDto): ItensDaJanela {
  const grupos: Record<keyof ItensDaJanela, ItemDaJanelaDto[]> = {
    aguardandoDecisao: [],
    retidas: [],
    naProtecaoDeDados: [],
    proprias: [],
    decididas: [],
  };
  const aceita = janelaAceitaDecisao(revisao);
  for (const item of revisao.itens) grupos[grupoDe(item, aceita)].push(item);
  return grupos;
}

function grupoDe(item: ItemDaJanelaDto, aceitaDecisao: boolean): keyof ItensDaJanela {
  const comAcao = GRUPO_DA_SITUACAO[item.situacao.codigo];
  if (!aceitaDecisao || comAcao === undefined) return 'decididas';
  return item.ehDoLeitor ? 'proprias' : comAcao;
}

/** Quantas concessões aguardando decisão ainda não têm decisão. */
export function semDecisao(
  itens: readonly ItemDaJanelaDto[],
  decisoes: DecisoesDaMigracao,
): number {
  return itens.filter((item) => !decisoes.has(item.concessaoId)).length;
}

export function quantidadeDeRecusas(decisoes: DecisoesDaMigracao): number {
  return [...decisoes.values()].filter((decisao) => decisao === ResultadoDaMigracao.RECUSAR).length;
}

/** As decisões na ordem das concessões da revisão, só das que pertencem à etapa. */
export function decisoesDaEtapa(
  itens: readonly ItemDaJanelaDto[],
  decisoes: DecisoesDaMigracao,
): { readonly concessaoId: string; readonly decisao: DecisaoDaMigracao }[] {
  return itens.flatMap((item) => {
    const decisao = decisoes.get(item.concessaoId);
    return decisao === undefined ? [] : [{ concessaoId: item.concessaoId, decisao }];
  });
}

const MINUTO = 60_000;
const MINUTOS_POR_HORA = 60;

/** O tempo que falta para o prazo, em horas e minutos; `null` quando o prazo já passou. */
export function tempoRestante(prazo: string, agora: number): string | null {
  const minutos = Math.ceil((Date.parse(prazo) - agora) / MINUTO);
  if (!(minutos > 0)) return null;
  const horas = Math.floor(minutos / MINUTOS_POR_HORA);
  const resto = minutos % MINUTOS_POR_HORA;
  return horas === 0 ? `${resto} min` : `${horas} h ${resto} min`;
}
