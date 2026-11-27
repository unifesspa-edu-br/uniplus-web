import type {
  ConcessaoSuspensaDto,
  DecisaoDaReclassificacaoDto,
  EtapaDaVersao,
} from '@uniplus/shared-data/autorizacao';

/** A etapa que a pessoa decide, com o rótulo que a API dá a ela. */
export interface EtapaDaDecisao {
  readonly codigo: EtapaDaVersao;
  readonly rotulo: string;
}

/**
 * As etapas da pessoa que as concessões trazem, com o rótulo da API. A etapa que nenhuma
 * concessão traz não tem o que decidir, nem rótulo para mostrar.
 */
export function etapasDaDecisao(
  concessoes: readonly ConcessaoSuspensaDto[],
  etapas: readonly EtapaDaVersao[],
): readonly EtapaDaDecisao[] {
  const rotulos = new Map<string, string>();
  for (const concessao of concessoes) {
    for (const etapa of [...concessao.etapasExigidas, ...concessao.etapasDecididas]) {
      rotulos.set(etapa.codigo, etapa.rotulo);
    }
  }
  return etapas.flatMap((codigo) => {
    const rotulo = rotulos.get(codigo);
    return rotulo === undefined ? [] : [{ codigo, rotulo }];
  });
}

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

function contem(etapas: ConcessaoSuspensaDto['etapasExigidas'], etapa: EtapaDaVersao): boolean {
  return etapas.some((candidata) => candidata.codigo === etapa);
}

/** A etapa já decidiu a concessão. */
export function etapaDecidida(concessao: ConcessaoSuspensaDto, etapa: EtapaDaVersao): boolean {
  return contem(concessao.etapasDecididas, etapa);
}

/** A concessão exige a etapa e ela ainda não decidiu. */
export function aguardaAEtapa(concessao: ConcessaoSuspensaDto, etapa: EtapaDaVersao): boolean {
  return contem(concessao.etapasExigidas, etapa) && !etapaDecidida(concessao, etapa);
}

/** As concessões que ainda aguardam a etapa. */
export function pendentesDaEtapa(
  concessoes: readonly ConcessaoSuspensaDto[],
  etapa: EtapaDaVersao,
): readonly ConcessaoSuspensaDto[] {
  return concessoes.filter((concessao) => aguardaAEtapa(concessao, etapa));
}

/** As pendentes que a pessoa pode decidir: a concessão dela fica para outra pessoa. */
export function decidiveisDaEtapa(
  concessoes: readonly ConcessaoSuspensaDto[],
  etapa: EtapaDaVersao,
): readonly ConcessaoSuspensaDto[] {
  return pendentesDaEtapa(concessoes, etapa).filter((concessao) => !concessao.ehDoLeitor);
}

/** As concessões que a leitura tem, na ordem dos identificadores; os que ela não tem ficam de fora. */
function conhecidas(
  porId: ReadonlyMap<string, ConcessaoSuspensaDto>,
  ids: readonly string[],
): ConcessaoSuspensaDto[] {
  return ids.flatMap((id) => porId.get(id) ?? []);
}

export function desfechoDaDecisao(
  decisao: DecisaoDaReclassificacaoDto,
  concessoes: readonly ConcessaoSuspensaDto[],
): DesfechoDaDecisao {
  const porId = new Map(concessoes.map((c) => [c.concessaoId, c]));
  const citadas = [...decisao.paraOutraPessoa, ...decisao.puladasPorEscopo];
  return {
    decididas: decisao.decididas.length,
    liberadas: decisao.liberadas.length,
    paraOutraPessoa: conhecidas(porId, decisao.paraOutraPessoa),
    puladasPorEscopo: conhecidas(porId, decisao.puladasPorEscopo),
    ausentes: citadas.length - conhecidas(porId, citadas).length,
  };
}
