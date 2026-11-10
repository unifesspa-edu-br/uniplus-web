import type {
  DecisaoDaMigracao,
  ItemDaJanelaDto,
  JanelaDeMigracaoDto,
} from '@uniplus/shared-data/autorizacao';

/** O que cada pessoa decide, por concessão. */
export type DecisoesDaMigracao = ReadonlyMap<string, DecisaoDaMigracao>;

/** As concessões da janela, separadas pelo que a pessoa que lê pode fazer com cada uma. */
export interface ItensDaJanela {
  /** Aguardam o lote da gestão de acessos e não são da pessoa que lê. */
  readonly doLote: readonly ItemDaJanelaDto[];
  /** O lote as reteve para outra pessoa da gestão de acessos decidir. */
  readonly retidas: readonly ItemDaJanelaDto[];
  /** Migram só depois da decisão da proteção de dados. */
  readonly naProtecaoDeDados: readonly ItemDaJanelaDto[];
  /** São da pessoa que lê e ainda aguardam decisão: outra pessoa decide, e a tela não oferece ação. */
  readonly proprias: readonly ItemDaJanelaDto[];
  /** Têm situação final, ou a janela já não aceita decisão. */
  readonly decididas: readonly ItemDaJanelaDto[];
}

type GrupoComAcao = 'doLote' | 'retidas' | 'naProtecaoDeDados';

const GRUPO_DA_SITUACAO: Readonly<Record<string, GrupoComAcao>> = {
  aguardando_lote: 'doLote',
  retida: 'retidas',
  aguardando_protecao_de_dados: 'naProtecaoDeDados',
};

/** A janela aceita decisão enquanto está aberta; encerrando ou encerrada, só mostra a situação final. */
export function janelaAceitaDecisao(janela: Pick<JanelaDeMigracaoDto, 'situacao'>): boolean {
  return janela.situacao === 'aberta';
}

export function separarItens(janela: JanelaDeMigracaoDto): ItensDaJanela {
  const grupos: Record<keyof ItensDaJanela, ItemDaJanelaDto[]> = {
    doLote: [],
    retidas: [],
    naProtecaoDeDados: [],
    proprias: [],
    decididas: [],
  };
  const aceita = janelaAceitaDecisao(janela);
  for (const item of janela.itens) grupos[grupoDe(item, aceita)].push(item);
  return grupos;
}

function grupoDe(item: ItemDaJanelaDto, aceitaDecisao: boolean): keyof ItensDaJanela {
  const comAcao = GRUPO_DA_SITUACAO[item.situacao];
  if (!aceitaDecisao || comAcao === undefined) return 'decididas';
  return item.ehDoLeitor ? 'proprias' : comAcao;
}

/** Quantas concessões do lote ainda não têm decisão. */
export function semDecisao(
  itens: readonly ItemDaJanelaDto[],
  decisoes: DecisoesDaMigracao,
): number {
  return itens.filter((item) => !decisoes.has(item.concessaoId)).length;
}

export function quantidadeDeRecusas(decisoes: DecisoesDaMigracao): number {
  return [...decisoes.values()].filter((decisao) => decisao === 'recusar').length;
}

/** As decisões na ordem das concessões da janela, só das que pertencem à etapa. */
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
