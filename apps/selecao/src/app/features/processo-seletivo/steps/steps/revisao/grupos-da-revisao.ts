import type { AvisoConformidadeDto, ItemConformidadeDto } from '@uniplus/shared-data/selecao';

import { destinoDoItem, passoPeloRotulo } from './destino-das-pendencias';

/** Item de conformidade agrupado por `dimensao`: a navegação da Revisão é por este campo, nunca por texto. */
export interface GrupoDeConformidade {
  readonly dimensao: string;
  readonly itens: readonly ItemConformidadeDto[];
  readonly ok: boolean;
}

/** Item do checklist estrutural como o painel de revisão o mostra. */
export interface ItemDaRevisao {
  readonly codigo: string;
  readonly mensagem: string;
  readonly ok: boolean;
  readonly idDaMensagem: string;
  /** `null` quando o item está conforme, ou quando o botão do passo basta. */
  readonly orientacao: { readonly id: string; readonly texto: string } | null;
  /** `null` quando o item está conforme, ou quando nenhum passo o resolve. */
  readonly passo: { readonly indice: number; readonly nome: string } | null;
}

export interface GrupoDaRevisao {
  readonly dimensao: string;
  readonly ok: boolean;
  readonly itens: readonly ItemDaRevisao[];
}

/** Aviso de conformidade como o painel de revisão o mostra: o que não impede a publicação, mas pede conferência. */
export interface AvisoDaRevisao {
  readonly codigo: string;
  readonly dimensao: string;
  readonly rotuloDaDimensao: string;
  readonly mensagem: string;
  /** Prefixado pela dimensão: a identidade de um aviso é o par `codigo`/`dimensao`. */
  readonly idDaMensagem: string;
  /** `null` quando nenhum passo do assistente declara o que o aviso aponta. */
  readonly passo: { readonly indice: number; readonly nome: string } | null;
}

/**
 * Rótulo de cada dimensão conhecida. O código chega em `snake_case` e sem acento, e o painel é
 * texto para o operador. `Map`, e não objeto literal, porque o código vem do servidor e um objeto
 * responderia por chaves herdadas como `constructor`.
 */
const ROTULO_POR_DIMENSAO: ReadonlyMap<string, string> = new Map<string, string>([
  ['identificacao', 'Identificação'],
  ['taxa_inscricao', 'Taxa de inscrição'],
  ['distribuicao_vagas', 'Distribuição de vagas'],
  ['cascata_remanejamento', 'Cascata de remanejamento'],
  ['cronograma', 'Cronograma'],
  ['exigencias_documentais', 'Exigências documentais'],
  ['contagem_de_prazos', 'Contagem de prazos'],
  ['classificacao', 'Classificação'],
  ['atendimento_especializado', 'Atendimento especializado'],
  ['coleta_de_fatos', 'Coleta de fatos'],
  ['bonus_regional', 'Bônus regional'],
  ['desempate', 'Critérios de desempate'],
  ['etapas', 'Etapas'],
]);

/**
 * Rótulo legível de uma dimensão vinda do contrato. A dimensão que este cliente ainda não conhece
 * cai na grafia do próprio código, sem `_`, em vez de sumir do painel.
 */
export function rotuloDaDimensao(dimensao: string): string {
  const conhecido = ROTULO_POR_DIMENSAO.get(dimensao);
  if (conhecido !== undefined) return conhecido;
  const comEspacos = dimensao.replace(/_/g, ' ').trim();
  return comEspacos.charAt(0).toUpperCase() + comEspacos.slice(1);
}

/**
 * Agrupa o checklist estrutural por `dimensao`, na ordem em que os grupos aparecem no vetor
 * original. O grupo inteiramente verde não é filtrado aqui: decidir se a publicação está liberada
 * é de quem confere.
 */
export function agruparPorDimensao(
  itens: readonly ItemConformidadeDto[],
): readonly GrupoDeConformidade[] {
  const grupos: GrupoDeConformidade[] = [];
  const indicePorDimensao = new Map<string, number>();

  for (const item of itens) {
    const indiceExistente = indicePorDimensao.get(item.dimensao);
    if (indiceExistente === undefined) {
      indicePorDimensao.set(item.dimensao, grupos.length);
      grupos.push({ dimensao: item.dimensao, itens: [item], ok: item.ok });
      continue;
    }

    const grupo = grupos[indiceExistente];
    if (grupo === undefined) continue;
    grupos[indiceExistente] = {
      ...grupo,
      itens: [...grupo.itens, item],
      ok: grupo.ok && item.ok,
    };
  }

  return grupos;
}

function idDoItem(codigo: string, parte: 'mensagem' | 'orientacao'): string {
  return `rev-item-${codigo}-${parte}`;
}

function comoItemDaRevisao(item: ItemConformidadeDto): ItemDaRevisao {
  const { codigo, mensagem, ok } = item;
  const idDaMensagem = idDoItem(codigo, 'mensagem');
  if (ok) {
    return { codigo, mensagem, ok, idDaMensagem, orientacao: null, passo: null };
  }

  const destino = destinoDoItem(codigo, item.dimensao);
  const texto = destino?.orientacao;
  const orientacao = texto === undefined ? null : { id: idDoItem(codigo, 'orientacao'), texto };
  const passo = destino?.passo == null ? null : passoPeloRotulo(destino.passo);
  return { codigo, mensagem, ok, idDaMensagem, orientacao, passo };
}

/** Os grupos do checklist com o que o painel mostra de cada item, calculado uma vez. */
export function comoGruposDaRevisao(
  grupos: readonly GrupoDeConformidade[],
): readonly GrupoDaRevisao[] {
  return grupos.map((grupo) => ({ ...grupo, itens: grupo.itens.map(comoItemDaRevisao) }));
}

/**
 * Os passos em que o checklist estrutural tem item reprovado: o mesmo destino que o painel da
 * Revisão aponta no botão de cada item, para o stepper e a Revisão não se contradizerem.
 */
export function passosComPendencia(itens: readonly ItemConformidadeDto[]): ReadonlySet<number> {
  const indices = new Set<number>();
  for (const grupo of comoGruposDaRevisao(agruparPorDimensao(itens))) {
    for (const item of grupo.itens) {
      if (!item.ok && item.passo !== null) indices.add(item.passo.indice);
    }
  }
  return indices;
}

/**
 * Os avisos do servidor com o que o painel mostra de cada um. O atalho para o passo segue o mesmo
 * destino que o item de pendência da mesma dimensão usa, para os dois não se contradizerem.
 */
export function comoAvisosDaRevisao(
  avisos: readonly AvisoConformidadeDto[],
): readonly AvisoDaRevisao[] {
  return avisos.map(({ codigo, dimensao, mensagem }) => {
    const destino = destinoDoItem(codigo, dimensao);
    return {
      codigo,
      dimensao,
      rotuloDaDimensao: rotuloDaDimensao(dimensao),
      mensagem,
      idDaMensagem: `rev-aviso-${dimensao}-${codigo}`,
      passo: destino?.passo == null ? null : passoPeloRotulo(destino.passo),
    };
  });
}
