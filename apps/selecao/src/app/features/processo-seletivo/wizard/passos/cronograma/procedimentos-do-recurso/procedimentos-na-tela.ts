import { rotuloDoTipoDeDecisao } from '@uniplus/shared-data/selecao';
import type { ItemDeAvaliacaoDaEtapa } from '../../../processo-seletivo.models';

import type {
  AreaDoEnemDoProcedimento,
  DocumentoDaConfiguracaoItemDeAvaliacao,
  DocumentoDaConfiguracaoProcedimentoDeRecurso,
  TipoDeDecisaoDoDocumento,
} from '@uniplus/shared-data/selecao';
import {
  alvoDoProcedimento,
  type AlvoDoProcedimento,
} from '../../../documento/edicoes/procedimentos-de-recurso.edicao';
import { mesmoAlvo } from '../../../shared/procedimentos-do-recurso/unicidade-dos-procedimentos';
import type { ModoDoTipo } from '../../../shared/procedimentos-do-recurso/procedimentos-da-janela';

type Procedimento = DocumentoDaConfiguracaoProcedimentoDeRecurso;

const ROTULO_DA_DECISAO_INTEIRA = 'Procedimento de recurso';

const NOMES_DAS_AREAS: ReadonlyMap<string, string> = new Map([
  ['REDACAO', 'Redação'],
  ['CIENCIAS_DA_NATUREZA', 'Ciências da natureza'],
  ['CIENCIAS_HUMANAS', 'Ciências humanas'],
  ['LINGUAGENS', 'Linguagens'],
  ['MATEMATICA', 'Matemática'],
]);

export function rotuloDaAreaDoEnem(area: string): string {
  return NOMES_DAS_AREAS.get(area) ?? area;
}

/** Um item ou uma área que o procedimento pode contestar, com o nome que a tela mostra. */
export interface AlvoOferecido {
  readonly alvo: AlvoDoProcedimento;
  readonly rotulo: string;
}

/** Um tipo de decisão do recurso e os procedimentos que a janela já declara para ele. */
export interface TipoDeDecisaoNaTela {
  readonly tipoDeDecisao: TipoDeDecisaoDoDocumento;
  readonly rotulo: string;
  /** Falso quando a fase ou a etapa deixou de declarar o tipo, mas ainda há procedimento para ele. */
  readonly declarado: boolean;
  readonly procedimentos: readonly Procedimento[];
}

/** O que o tipo de decisão mostra em cada seletor de regra: a decisão inteira ou um alvo. */
export interface LinhaDoProcedimento {
  readonly chave: string;
  readonly alvo: AlvoDoProcedimento | null;
  readonly rotulo: string;
  readonly declarado: Procedimento | null;
  /** O procedimento declarado cujo item ou modo a tela não oferece mais, num tipo ainda declarado. */
  readonly foraDoOferecido: boolean;
  readonly alvoInexistente?: boolean;
  /** O procedimento que a tela não oferece mais, ou de um tipo que o lugar deixou de declarar: só se remove. */
  readonly soRemove: boolean;
  readonly ocorrencia: number;
}

/** Itens já têm chave local antes de salvar; rótulo e posição não identificam o alvo. */
export function alvosOferecidos(
  itens: readonly (DocumentoDaConfiguracaoItemDeAvaliacao | ItemDeAvaliacaoDaEtapa)[],
  areasDoEnem: readonly AreaDoEnemDoProcedimento[],
): readonly AlvoOferecido[] {
  const dosItens = itens.flatMap(itemComoAlvo);
  return [
    ...dosItens,
    ...areasDoEnem.map((area) => ({
      alvo: { areaDoEnem: area },
      rotulo: rotuloDaAreaDoEnem(area),
    })),
  ];
}

function itemComoAlvo(
  item: DocumentoDaConfiguracaoItemDeAvaliacao | ItemDeAvaliacaoDaEtapa,
): readonly AlvoOferecido[] {
  const chave = item.chave;
  return chave == null || chave === ''
    ? []
    : [{ alvo: { itemDeAvaliacaoChave: chave }, rotulo: item.rotulo || 'Item sem nome' }];
}

/**
 * Os tipos que o lugar declara, na ordem em que os declara, e depois os tipos que só aparecem nos
 * procedimentos: eles continuam visíveis para serem removidos.
 */
export function tiposNaTela(
  procedimentos: readonly Procedimento[],
  tiposDeclarados: readonly TipoDeDecisaoDoDocumento[],
): readonly TipoDeDecisaoNaTela[] {
  const declarados = [...new Set(tiposDeclarados)];
  const sobrando = procedimentos.map((procedimento) => procedimento.tipoDeDecisao);
  const demais = [...new Set(sobrando)].filter((tipo) => !declarados.includes(tipo));
  return [
    ...declarados.map((tipo) => umTipo(tipo, true, procedimentos)),
    ...demais.map((tipo) => umTipo(tipo, false, procedimentos)),
  ];
}

/**
 * As linhas do tipo de decisão no modo dado: uma para a decisão inteira ou uma por alvo oferecido,
 * e depois uma para cada procedimento declarado que nenhuma delas cobre, que só se remove.
 */
export function linhasDoTipo(
  tipo: TipoDeDecisaoNaTela,
  modo: ModoDoTipo,
  oferecidos: readonly AlvoOferecido[],
): readonly LinhaDoProcedimento[] {
  const base = tipo.declarado ? linhasOferecidas(tipo, modo, oferecidos) : [];
  const sobras = tipo.procedimentos.flatMap((procedimento, indice) => {
    const ocorrencia = ocorrenciaDoAlvo(tipo.procedimentos, indice);
    const oferecida = base.some((linha) => mesmoAlvo(linha.alvo, procedimento.alvo));
    return oferecida && ocorrencia === 0
      ? []
      : [linhaDaSobra(procedimento, tipo, oferecidos, ocorrencia)];
  });
  return [...base, ...sobras];
}

function ocorrenciaDoAlvo(procedimentos: readonly Procedimento[], indice: number): number {
  return procedimentos
    .slice(0, indice)
    .filter((anterior) => mesmoAlvo(anterior.alvo, procedimentos[indice].alvo)).length;
}

function umTipo(
  tipoDeDecisao: TipoDeDecisaoDoDocumento,
  declarado: boolean,
  procedimentos: readonly Procedimento[],
): TipoDeDecisaoNaTela {
  return {
    tipoDeDecisao,
    rotulo: rotuloDoTipoDeDecisao(tipoDeDecisao),
    declarado,
    procedimentos: procedimentos.filter(
      (procedimento) => procedimento.tipoDeDecisao === tipoDeDecisao,
    ),
  };
}

function linhasOferecidas(
  tipo: TipoDeDecisaoNaTela,
  modo: ModoDoTipo,
  oferecidos: readonly AlvoOferecido[],
): readonly LinhaDoProcedimento[] {
  const daDecisaoInteira = { alvo: null, rotulo: ROTULO_DA_DECISAO_INTEIRA };
  const alvos = modo === 'tipoInteiro' ? [daDecisaoInteira] : oferecidos;
  return alvos.map((oferecido) => linhaOferecida(tipo, oferecido));
}

function linhaOferecida(
  tipo: TipoDeDecisaoNaTela,
  { alvo, rotulo }: { alvo: AlvoDoProcedimento | null; rotulo: string },
): LinhaDoProcedimento {
  const declarado = tipo.procedimentos.find((procedimento) => mesmoAlvo(procedimento.alvo, alvo));
  return {
    chave: chaveDoAlvo(alvo),
    alvo,
    rotulo,
    declarado: declarado ?? null,
    foraDoOferecido: false,
    soRemove: false,
    ocorrencia: 0,
  };
}

function linhaDaSobra(
  procedimento: Procedimento,
  tipo: TipoDeDecisaoNaTela,
  oferecidos: readonly AlvoOferecido[],
  ocorrencia: number,
): LinhaDoProcedimento {
  return {
    ...apresentacaoDoAlvo(alvoDoProcedimento(procedimento.alvo), oferecidos),
    chave: chaveDoAlvo(alvoDoProcedimento(procedimento.alvo), ocorrencia),
    declarado: procedimento,
    foraDoOferecido: tipo.declarado && ocorrencia === 0,
    soRemove: true,
    ocorrencia,
  };
}

function apresentacaoDoAlvo(
  alvo: AlvoDoProcedimento | null,
  oferecidos: readonly AlvoOferecido[],
): {
  readonly alvo: AlvoDoProcedimento | null;
  readonly rotulo: string;
  readonly alvoInexistente: boolean;
} {
  const oferecido = oferecidos.find((candidato) => mesmoAlvo(candidato.alvo, alvo));
  return {
    alvo,
    rotulo: oferecido?.rotulo ?? rotuloDoAlvoPerdido(alvo),
    alvoInexistente: alvo !== null && oferecido === undefined,
  };
}

function rotuloDoAlvoPerdido(alvo: AlvoDoProcedimento | null): string {
  if (alvo === null) return ROTULO_DA_DECISAO_INTEIRA;
  return 'areaDoEnem' in alvo
    ? rotuloDaAreaDoEnem(alvo.areaDoEnem)
    : 'Item que a etapa não tem mais';
}

function chaveDoAlvo(alvo: AlvoDoProcedimento | null, ocorrencia = 0): string {
  if (alvo === null) return JSON.stringify(['decisao-inteira', ocorrencia]);
  return JSON.stringify([alvo, ocorrencia]);
}
