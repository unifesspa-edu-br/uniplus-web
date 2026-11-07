import type { ProblemDetails } from '@uniplus/shared-core/http';

import type { CampoDaFase } from './configuracao-da-fase';

/** Recusa do servidor já traduzida: o que vai por campo, e o que sobra ao resumo. */
export interface RecusaTraduzida {
  readonly porCampo: ReadonlyMap<CampoDaFase, string>;
  readonly gerais: readonly string[];
}

/**
 * Mensagem por campo para cada código de recusa do domínio.
 *
 * O texto é estático e escrito aqui: `detail` e `errors[].message` do servidor
 * podem carregar conteúdo que não cabe repetir na tela, e a chave estável para
 * i18n é o código, não a frase.
 */
const MENSAGEM_POR_CODIGO: ReadonlyMap<string, { campo: CampoDaFase; mensagem: string }> = new Map([
  [
    'uniplus.selecao.produto_da_fase.papel_em_ato_que_nao_eh_resultado',
    {
      campo: 'produtos' as CampoDaFase,
      mensagem:
        'Só publicação que o catálogo marca como resultado recebe papel preliminar ou definitivo.',
    },
  ],
  [
    'uniplus.selecao.produto_da_fase.ato_nao_encontrado_no_catalogo',
    {
      campo: 'produtos' as CampoDaFase,
      mensagem:
        'O tipo de ato declarado não tem versão vigente no catálogo de Publicações. Escolha outro.',
    },
  ],
  [
    'uniplus.selecao.produto_da_fase.papel_desconhecido',
    {
      campo: 'produtos' as CampoDaFase,
      mensagem: 'O papel declarado para a publicação não existe.',
    },
  ],
  [
    'uniplus.selecao.fase_cronograma.ato_duplicado_na_fase',
    {
      campo: 'produtos' as CampoDaFase,
      mensagem: 'A fase declara a mesma publicação mais de uma vez no mesmo papel.',
    },
  ],
  [
    'uniplus.selecao.fase_cronograma.parecer_individual_sem_resultado',
    {
      campo: 'emiteParecerIndividual' as CampoDaFase,
      mensagem: 'A fase promete parecer individual e não publica nenhum resultado.',
    },
  ],
  [
    'uniplus.selecao.processo_seletivo.conclusao_nao_declarada',
    {
      campo: 'faseConcluinteCodigo' as CampoDaFase,
      mensagem:
        'A fase publica resultado preliminar e não publica o definitivo: declare qual fase conclui o ciclo recursal.',
    },
  ],
  [
    'uniplus.selecao.processo_seletivo.conclusao_declarada_sem_preliminar',
    {
      campo: 'faseConcluinteCodigo' as CampoDaFase,
      mensagem: 'Só fase que publica resultado preliminar declara quem a conclui.',
    },
  ],
  [
    'uniplus.selecao.processo_seletivo.conclusao_declarada_em_fase_que_se_conclui',
    {
      campo: 'faseConcluinteCodigo' as CampoDaFase,
      mensagem:
        'A fase não conclui a si mesma por declaração: para encerrar o próprio ciclo, ela publica o resultado definitivo.',
    },
  ],
  [
    'uniplus.selecao.processo_seletivo.fase_concluinte_fora_do_cronograma',
    {
      campo: 'faseConcluinteCodigo' as CampoDaFase,
      mensagem: 'A fase declarada como concluinte não está no cronograma.',
    },
  ],
  [
    'uniplus.selecao.processo_seletivo.fase_concluinte_sem_resultado_definitivo',
    {
      campo: 'faseConcluinteCodigo' as CampoDaFase,
      mensagem: 'A fase declarada como concluinte não publica nenhum resultado definitivo.',
    },
  ],
  [
    'uniplus.selecao.processo_seletivo.fase_concluinte_antecede_a_concluida',
    {
      campo: 'faseConcluinteCodigo' as CampoDaFase,
      mensagem: 'A fase concluinte não pode vir antes, na linha do tempo, da fase que ela encerra.',
    },
  ],
  [
    'uniplus.selecao.processo_seletivo.fase_concluinte_comeca_antes_da_concluida',
    {
      campo: 'faseConcluinteCodigo' as CampoDaFase,
      mensagem: 'A janela da fase concluinte começa antes da janela da fase que ela encerra.',
    },
  ],
  [
    'uniplus.selecao.regra_recurso_fase.fase_sem_produto_preliminar',
    {
      campo: 'produtos' as CampoDaFase,
      mensagem:
        'A fase admite recurso e não publica nenhum resultado preliminar de que ele possa caber.',
    },
  ],
  [
    'uniplus.selecao.regra_recurso_fase.ancora_nao_eh_produto_preliminar_da_fase',
    {
      campo: 'recurso.ancora' as CampoDaFase,
      mensagem:
        'O prazo de recurso precisa contar de um resultado preliminar publicado por esta própria fase.',
    },
  ],
  [
    'uniplus.selecao.regra_recurso_fase.ancora_em_ato_congelante',
    {
      campo: 'recurso.ancora' as CampoDaFase,
      mensagem: 'O prazo de recurso não conta do ato que congela a configuração do processo.',
    },
  ],
  [
    'uniplus.selecao.regra_recurso_fase.ancora_em_ato_irreversivel',
    {
      campo: 'recurso.ancora' as CampoDaFase,
      mensagem: 'Não cabe recurso contra ato de efeito irreversível.',
    },
  ],
  [
    'uniplus.selecao.regra_recurso_fase.prazo_em_dias_corridos',
    {
      campo: 'recurso.prazo' as CampoDaFase,
      mensagem: 'Prazo de interposição em dias corridos não é aceito. Use dias úteis ou horas.',
    },
  ],
  [
    'uniplus.selecao.regra_recurso_fase.prazo_em_fracao_de_dia_util',
    {
      campo: 'recurso.prazo' as CampoDaFase,
      mensagem: 'Prazo de interposição em dias úteis exige valor inteiro.',
    },
  ],
  [
    'uniplus.selecao.regra_recurso_fase.prazo_sem_unidade_declaravel',
    {
      campo: 'recurso.prazo' as CampoDaFase,
      mensagem: 'Declare a unidade do prazo de interposição: dias úteis ou horas.',
    },
  ],
  [
    'uniplus.selecao.regra_recurso_fase.prazo_nao_positivo',
    {
      campo: 'recurso.prazo' as CampoDaFase,
      mensagem: 'O prazo de interposição precisa ser maior que zero.',
    },
  ],
  [
    'uniplus.selecao.regra_recurso_fase.suspensividade_incompleta',
    {
      campo: 'recurso.suspensividadePrimeiraInstancia' as CampoDaFase,
      mensagem: 'A suspensividade exige valor e unidade juntos, ou nenhum dos dois.',
    },
  ],
  [
    'uniplus.selecao.regra_recurso_fase.suspensividade_unidade_nao_declaravel',
    {
      campo: 'recurso.suspensividadePrimeiraInstancia' as CampoDaFase,
      mensagem: 'A unidade da suspensividade não é declarável.',
    },
  ],
  [
    'uniplus.selecao.regra_recurso_fase.suspensividade_nao_positiva',
    {
      campo: 'recurso.suspensividadePrimeiraInstancia' as CampoDaFase,
      mensagem: 'O prazo de suspensividade precisa ser maior que zero.',
    },
  ],
  [
    'uniplus.selecao.regra_recurso_fase.regra_catalogo_invalida',
    {
      campo: 'recurso.regra' as CampoDaFase,
      mensagem: 'A regra escolhida não rege prazo de recurso, ou divergiu do catálogo de regras.',
    },
  ],
  [
    'uniplus.selecao.banca_requerida.recorte_de_competencia_obrigatorio',
    {
      campo: 'bancasRequeridas' as CampoDaFase,
      mensagem:
        'A fase requer mais de uma banca do mesmo tipo: cada uma precisa declarar as categorias de documento que julga.',
    },
  ],
  [
    'uniplus.selecao.banca_requerida.recorte_de_competencia_duplicado',
    {
      campo: 'bancasRequeridas' as CampoDaFase,
      mensagem: 'Duas bancas do mesmo tipo declaram o mesmo recorte de competência.',
    },
  ],
  [
    'uniplus.selecao.banca_requerida.categoria_duplicada_no_recorte',
    {
      campo: 'bancasRequeridas' as CampoDaFase,
      mensagem: 'A banca declara a mesma categoria de documento mais de uma vez.',
    },
  ],
  [
    'uniplus.selecao.fase_cronograma.tipo_banca_nao_encontrado',
    {
      campo: 'bancasRequeridas' as CampoDaFase,
      mensagem: 'O tipo de banca escolhido saiu do cadastro. Escolha outro.',
    },
  ],
  [
    'uniplus.selecao.fase_cronograma.categoria_documento_nao_encontrada',
    {
      campo: 'bancasRequeridas' as CampoDaFase,
      mensagem: 'Uma categoria de documento do recorte saiu do cadastro. Refaça o recorte.',
    },
  ],
]);

/** A unidade responsável escolhida para a fase saiu do cadastro de Organização. */
export const UNIDADE_RESPONSAVEL_NAO_ENCONTRADA =
  'uniplus.selecao.fase_cronograma.unidade_responsavel_nao_encontrada';

/** A unidade é escolhida no Cronograma; esta tela não tem o seletor, então só orienta aonde ir. */
const ORIENTACAO_DA_UNIDADE_NAO_ENCONTRADA =
  'a unidade desta fase saiu do cadastro. Corrija a unidade da fase no passo Cronograma.';

/**
 * Distribui a recusa do servidor pelos campos da fase que está aberta.
 *
 * O `field` chega como `fases[i]` ou `fases[i].campo`, e `i` é a posição da fase
 * na coleção enviada — que é a mesma do rascunho. Recusa de outra fase não vai
 * para o campo: apontá-la no controle que está à vista mandaria corrigir o que
 * não está errado, então ela vai ao resumo nomeando a fase de origem.
 *
 * Código sem tradução também vai ao resumo, com o título que o servidor já
 * devolve em pt-BR: esconder a recusa seria pior do que exibi-la genérica.
 */
export function traduzirRecusa(
  problema: ProblemDetails,
  indiceDaFaseAberta: number,
  nomeDaFase: (indice: number) => string,
): RecusaTraduzida {
  const porCampo = new Map<CampoDaFase, string>();
  const gerais: string[] = [];

  const erros = problema.errors ?? [];
  if (erros.length === 0) return { porCampo, gerais: [problema.title] };

  for (const erro of erros) {
    const destino = destinoDoErro(erro, problema.title, indiceDaFaseAberta, nomeDaFase);
    if ('geral' in destino) {
      gerais.push(destino.geral);
      continue;
    }
    // Uma fase mal declarada erra em vários itens da mesma coleção ao mesmo
    // tempo, e o campo é o mesmo para todos. A primeira é a que orienta.
    if (!porCampo.has(destino.campo)) porCampo.set(destino.campo, destino.mensagem);
  }

  return { porCampo, gerais };
}

type ErroDaRecusa = NonNullable<ProblemDetails['errors']>[number];

type DestinoDoErro = { readonly geral: string } | { campo: CampoDaFase; mensagem: string };

function destinoDoErro(
  erro: ErroDaRecusa,
  titulo: string,
  indiceDaFaseAberta: number,
  nomeDaFase: (indice: number) => string,
): DestinoDoErro {
  const indice = indiceDaFaseEm(erro.field);
  const onde = indice === null ? 'No cronograma' : `Na fase ${nomeDaFase(indice)}`;
  if (erro.code === UNIDADE_RESPONSAVEL_NAO_ENCONTRADA) {
    return { geral: `${onde}: ${ORIENTACAO_DA_UNIDADE_NAO_ENCONTRADA}` };
  }

  const conhecido = MENSAGEM_POR_CODIGO.get(erro.code);
  const texto = conhecido?.mensagem ?? titulo;
  if (indice === null || indice !== indiceDaFaseAberta) return { geral: `${onde}: ${texto}` };
  return conhecido ?? { geral: texto };
}

/** A posição da fase no `field` da recusa, ou `null` quando ele não a nomeia. */
function indiceDaFaseEm(field: string): number | null {
  const casamento = /^(?:\$\.|request\.)?fases\[(\d+)\]/i.exec(field);
  if (casamento === null) return null;
  const indice = Number(casamento[1]);
  return Number.isInteger(indice) ? indice : null;
}
