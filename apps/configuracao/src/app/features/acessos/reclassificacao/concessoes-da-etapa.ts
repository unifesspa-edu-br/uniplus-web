import type {
  ConcessaoSuspensaDto,
  DecisaoDaReclassificacaoDto,
  EtapaDaVersao,
} from '@uniplus/shared-data/autorizacao';

export const PESSOA_SEM_NOME = 'Pessoa sem nome informado';

/**
 * O que a decisão deixou para trás. Cada concessão vem como a leitura a trouxe, para distinguir
 * homônimos e escopos; as que a leitura não tem entram só na contagem de `ausentes`.
 */
export interface DesfechoDaDecisao {
  readonly decididas: number;
  readonly liberadas: number;
  readonly paraOutraPessoa: readonly ConcessaoSuspensaDto[];
  readonly puladasPorEscopo: readonly ConcessaoSuspensaDto[];
  readonly ausentes: number;
}

/** As concessões que ainda aguardam a etapa. */
export function pendentesDaEtapa(
  concessoes: readonly ConcessaoSuspensaDto[],
  etapa: EtapaDaVersao,
): readonly ConcessaoSuspensaDto[] {
  return concessoes.filter(
    (concessao) =>
      concessao.etapasExigidas.includes(etapa) && !concessao.etapasDecididas.includes(etapa),
  );
}

/** As pendentes que a pessoa pode decidir: a concessão dela fica para outra pessoa. */
export function decidiveisDaEtapa(
  concessoes: readonly ConcessaoSuspensaDto[],
  etapa: EtapaDaVersao,
): readonly ConcessaoSuspensaDto[] {
  return pendentesDaEtapa(concessoes, etapa).filter((concessao) => !concessao.ehDoLeitor);
}

export function desfechoDaDecisao(
  decisao: DecisaoDaReclassificacaoDto,
  concessoes: readonly ConcessaoSuspensaDto[],
): DesfechoDaDecisao {
  const porId = new Map(concessoes.map((c) => [c.concessaoId, c]));
  const ids = [...decisao.paraOutraPessoa, ...decisao.puladasPorEscopo];
  const conhecidas = (lista: readonly string[]): ConcessaoSuspensaDto[] =>
    lista.flatMap((id) => porId.get(id) ?? []);
  return {
    decididas: decisao.decididas.length,
    liberadas: decisao.liberadas.length,
    paraOutraPessoa: conhecidas(decisao.paraOutraPessoa),
    puladasPorEscopo: conhecidas(decisao.puladasPorEscopo),
    ausentes: ids.filter((id) => !porId.has(id)).length,
  };
}
