import type {
  ConcessaoSuspensaDto,
  DecisaoDaReclassificacaoDto,
  EtapaDaVersao,
} from '@uniplus/shared-data/autorizacao';

export const PESSOA_SEM_NOME = 'Pessoa sem nome informado';

/** O que a decisão deixou para trás, pelo nome de cada concessão. */
export interface DesfechoDaDecisao {
  readonly decididas: number;
  readonly liberadas: number;
  readonly paraOutraPessoa: readonly string[];
  readonly puladasPorEscopo: readonly string[];
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
  const nomes = new Map(
    concessoes.map((c) => [c.concessaoId, c.beneficiarioNome ?? PESSOA_SEM_NOME]),
  );
  const nomeDe = (id: string): string => nomes.get(id) ?? PESSOA_SEM_NOME;
  return {
    decididas: decisao.decididas.length,
    liberadas: decisao.liberadas.length,
    paraOutraPessoa: decisao.paraOutraPessoa.map(nomeDe),
    puladasPorEscopo: decisao.puladasPorEscopo.map(nomeDe),
  };
}
