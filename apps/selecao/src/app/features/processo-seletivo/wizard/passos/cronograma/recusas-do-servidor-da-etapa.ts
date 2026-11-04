import { UNIDADE_RESPONSAVEL_NAO_ENCONTRADA } from '../fase/recusas-da-fase';

/**
 * Texto próprio das recusas do servidor à etapa de nota do ENEM, que o título genérico não
 * orienta: cada um diz o que corrigir no passo.
 */
const RECUSA_DA_ETAPA_DE_NOTA_DO_ENEM: ReadonlyMap<string, string> = new Map([
  [
    'uniplus.selecao.processo_seletivo.etapa_nota_enem_nao_compoe_nota',
    'A etapa de nota do ENEM compõe a média: declare caráter classificatória (ou ambas) e um peso maior que zero.',
  ],
  [
    'uniplus.selecao.processo_seletivo.etapa_nota_enem_com_banca',
    'A etapa de nota do ENEM não admite banca: a nota é calculada, e quem julga o recurso é declarado na fase de recursos.',
  ],
  [
    'uniplus.selecao.processo_seletivo.etapa_nota_enem_com_produto_ou_recurso_em_ato',
    'A etapa de nota do ENEM não publica ato nem abre recurso contado de publicação: o resultado sai pela fase, e na etapa cabe só o recurso contado da ciência do candidato.',
  ],
]);

/** O texto da recusa à etapa de nota do ENEM, ou `null` quando a recusa é outra. */
export function recusaDaEtapaDeNotaDoEnem(codigo: string): string | null {
  return RECUSA_DA_ETAPA_DE_NOTA_DO_ENEM.get(codigo) ?? null;
}

/** Os campos da etapa sob os quais a recusa do servidor aparece; o nome é o que o servidor aponta. */
export type CampoDaEtapaComRecusa =
  | 'notaMinima'
  | 'notaMaxima'
  | 'passoDoLancamento'
  | 'formaDeAvaliacao'
  | 'regraConsolidacao'
  | 'itensDeAvaliacao'
  | 'escalaDeAtendimento';

/** Um campo de um item da lista, na chave `itensDeAvaliacao.2.rotulo`. */
export type CampoDeItemComRecusa =
  | `itensDeAvaliacao.${number}.${'rotulo' | 'id' | 'pontuacaoMaxima'}`
  | `escalaDeAtendimento.${number}.${'rotulo' | 'fracao'}`;

export type CampoComRecusa = CampoDaEtapaComRecusa | CampoDeItemComRecusa;

const CAMPOS_DA_ETAPA_COM_RECUSA: ReadonlySet<string> = new Set<CampoDaEtapaComRecusa>([
  'notaMinima',
  'notaMaxima',
  'passoDoLancamento',
  'formaDeAvaliacao',
  'regraConsolidacao',
  'itensDeAvaliacao',
  'escalaDeAtendimento',
]);

const CAMPO_DE_ITEM_COM_RECUSA =
  /^(?:itensDeAvaliacao\.\d+\.(?:rotulo|id|pontuacaoMaxima)|escalaDeAtendimento\.\d+\.(?:rotulo|fracao))$/;

/** A chave sob a qual a tela guarda a recusa do que o servidor apontou, ou `null` quando ela não tem campo. */
export function campoDaRecusa(
  local: {
    readonly campo: string | null;
    readonly posicao: number | null;
    readonly subcampo: string | null;
  } | null,
): CampoComRecusa | null {
  if (local?.campo == null) return null;
  const chave =
    local.posicao === null ? local.campo : `${local.campo}.${local.posicao}.${local.subcampo}`;
  if (CAMPOS_DA_ETAPA_COM_RECUSA.has(chave) || CAMPO_DE_ITEM_COM_RECUSA.test(chave)) {
    return chave as CampoComRecusa;
  }
  return null;
}

const RECUSA_DO_CAMPO_DA_ETAPA: ReadonlyMap<string, string> = new Map([
  [
    'uniplus.selecao.etapa_processo.nota_maxima_invalida',
    'A nota máxima precisa ser maior que zero.',
  ],
  [
    'uniplus.selecao.etapa_processo.nota_minima_acima_da_nota_maxima',
    'A nota mínima não pode passar da nota máxima.',
  ],
  [
    'uniplus.selecao.etapa_processo.nota_maxima_fora_do_passo',
    'A nota máxima precisa ser múltipla do passo do lançamento: ajuste uma das duas.',
  ],
  [
    'uniplus.selecao.etapa_processo.passo_do_lancamento_invalido',
    'O passo do lançamento precisa ser maior que zero.',
  ],
  [
    'uniplus.selecao.etapa_processo.forma_de_avaliacao_desconhecida',
    'Escolha a forma de avaliação: objetiva ou humana.',
  ],
  [
    'uniplus.selecao.etapa_processo.avaliacao_na_etapa_do_enem',
    'A etapa de nota do ENEM não declara forma de avaliação nem regra de consolidação: a nota vem do INEP.',
  ],
  [
    'uniplus.selecao.etapa_processo.regra_de_consolidacao_fora_da_forma_humana',
    'A regra de consolidação só vale na avaliação humana.',
  ],
  [
    'uniplus.selecao.etapa_processo.regra_de_consolidacao_invalida',
    'Escolha uma regra de consolidação que o catálogo oferece.',
  ],
  [
    'uniplus.selecao.etapa_processo.passo_na_forma_objetiva',
    'O passo do lançamento só vale na avaliação humana.',
  ],
  [
    'uniplus.selecao.etapa_processo.itens_na_etapa_do_enem',
    'A etapa de nota do ENEM não declara itens de avaliação nem escala de atendimento: a nota vem do INEP.',
  ],
  [
    'uniplus.selecao.etapa_processo.escala_sem_itens',
    'A escala de atendimento só vale em etapa com itens de avaliação.',
  ],
  [
    'uniplus.selecao.etapa_processo.escala_na_forma_objetiva',
    'A escala de atendimento só vale na avaliação humana.',
  ],
  [
    'uniplus.selecao.etapa_processo.passo_com_escala_de_atendimento',
    'Com escala de atendimento a banca escolhe o nível e não digita a nota: a etapa não declara passo do lançamento.',
  ],
  [
    'uniplus.selecao.item_de_avaliacao.rotulo_invalido',
    'Dê ao item um rótulo, de até 300 caracteres.',
  ],
  [
    'uniplus.selecao.item_de_avaliacao.rotulo_duplicado',
    'Outro item da etapa já tem este rótulo: o rótulo identifica o critério para a banca.',
  ],
  ['uniplus.selecao.item_de_avaliacao.id_duplicado', 'Este item aparece mais de uma vez na etapa.'],
  [
    'uniplus.selecao.item_de_avaliacao.pontuacao_maxima_invalida',
    'A pontuação máxima do item precisa ser maior que zero.',
  ],
  [
    'uniplus.selecao.item_de_avaliacao.pontuacao_fora_do_passo',
    'A pontuação máxima do item precisa ser múltipla do passo do lançamento da etapa: ajuste uma das duas.',
  ],
  [
    'uniplus.selecao.nivel_de_atendimento.rotulo_invalido',
    'Dê ao nível um rótulo, de até 100 caracteres.',
  ],
  [
    'uniplus.selecao.nivel_de_atendimento.fracao_invalida',
    'O percentual do nível precisa estar entre 0 e 100.',
  ],
  ['uniplus.selecao.nivel_de_atendimento.duplicado', 'Outro nível da escala já tem este rótulo.'],
  [
    'uniplus.selecao.nivel_de_atendimento.sem_nivel_completo',
    'A escala precisa de um nível de 100%: é o que vale a pontuação inteira do item.',
  ],
]);

/** O texto da recusa do servidor a um campo da etapa, ou `null` quando a recusa é outra. */
export function recusaDoCampoDaEtapa(codigo: string): string | null {
  return RECUSA_DO_CAMPO_DA_ETAPA.get(codigo) ?? null;
}

/**
 * A etapa e o campo que uma recusa do servidor aponta (`etapas[i].campo`, ou
 * `etapas[i].lista[j].subcampo` para o item de uma lista); o índice é o da etapa no que foi
 * enviado. `campo` é `null` quando a recusa aponta a etapa inteira.
 */
export function localDoErroDaEtapa(field: string): {
  readonly indice: number;
  readonly campo: string | null;
  readonly posicao: number | null;
  readonly subcampo: string | null;
} | null {
  const [, indice, campo, posicao, subcampo] =
    /^etapas\[(\d+)\](?:\.(\w+)(?:\[(\d+)\]\.(\w+))?)?$/.exec(field) ?? [];
  if (indice === undefined) return null;
  return {
    indice: Number(indice),
    campo: campo ?? null,
    posicao: posicao === undefined ? null : Number(posicao),
    subcampo: subcampo ?? null,
  };
}

/**
 * As posições, no cronograma enviado, das fases cuja unidade o servidor não encontrou. O campo é
 * lido sem prefixo de caminho (`$.`, `request.`) e sem caixa, como em `ehCampoDaResolucao`.
 */
export function fasesComUnidadeNaoEncontrada(
  erros: readonly { readonly field: string; readonly code: string }[],
): readonly number[] {
  return erros.flatMap((erro) => {
    const [, indice] =
      /^(?:\$\.|request\.)?fases\[(\d+)\]\.unidadeResponsavelId$/i.exec(erro.field) ?? [];
    return indice !== undefined && erro.code === UNIDADE_RESPONSAVEL_NAO_ENCONTRADA
      ? [Number(indice)]
      : [];
  });
}
