import type { ProblemDetails } from '@uniplus/shared-core/http';

import {
  PAPEL_DEFINITIVO,
  PAPEL_PRELIMINAR,
  type FaseDoCronograma,
} from '../../processo-seletivo.models';
import { decimalDoCampo } from '../../shared/numero-do-campo';

/** A fase encerra a matéria que abriu: do que ela publica não cabe mais recurso. */
export function publicaResultadoDefinitivo(produtos: FaseDoCronograma['produtos']): boolean {
  return produtos.some((produto) => produto.papel === PAPEL_DEFINITIVO);
}

/** Os produtos preliminares da fase — os únicos que podem ancorar o prazo. */
export function produtosPreliminares(
  produtos: FaseDoCronograma['produtos'],
): FaseDoCronograma['produtos'] {
  return produtos.filter((produto) => produto.papel === PAPEL_PRELIMINAR);
}

/**
 * Onde a mensagem de recusa aparece. É a chave que liga a conferência — e a
 * recusa do servidor — ao controle que a exibe: sem ela, tudo cairia no
 * resumo genérico do topo, e quem preencheu não saberia qual campo corrigir.
 *
 * `null` é o que não pertence a campo nenhum, e continua indo para o resumo.
 */
export type CampoDaFase =
  | 'produtos'
  | 'faseConcluinteCodigo'
  | 'emiteParecerIndividual'
  | 'bancasRequeridas'
  | 'recurso.regra'
  | 'recurso.prazo'
  | 'recurso.ancora'
  | 'recurso.suspensividadePrimeiraInstancia'
  | 'recurso.suspensividadeSegundaInstancia';

export interface ProblemaDaFase {
  readonly campo: CampoDaFase | null;
  readonly mensagem: string;
}

/** O que a tela precisa saber sobre um tipo de ato para conferir um produto. */
export interface AtoDoCatalogo {
  readonly nome: string;
  readonly ehResultado: boolean;
}

/**
 * O que impede gravar a configuração desta fase, com o campo de cada recusa.
 *
 * Só entra aqui o que a tela consegue afirmar com o que tem em mãos. Vigência do
 * ato, existência do tipo de banca no cadastro e coerência da regra com o
 * `rol_de_regras` continuam sendo do servidor: repetir a conferência aqui daria
 * duas fontes para a mesma regra, e a que ficasse desatualizada recusaria o que
 * o servidor aceita.
 *
 * A ordem importa. Dentro de um assunto, a primeira recusa é a que orienta —
 * cobrar a unidade do prazo antes de existir prazo mandaria corrigir o campo
 * errado.
 */
export function problemasDaFase(
  fase: FaseDoCronograma,
  fases: readonly FaseDoCronograma[],
  atoPorCodigo: ReadonlyMap<string, AtoDoCatalogo>,
  nomeDaBanca: (tipoBancaId: string) => string,
): readonly ProblemaDaFase[] {
  return [
    ...problemasDosProdutos(fase, atoPorCodigo),
    ...problemasDaConclusao(fase, fases),
    ...problemasDoParecer(fase),
    ...problemasDoRecurso(fase),
    ...problemasDasBancas(fase, nomeDaBanca),
  ];
}

function problemasDosProdutos(
  fase: FaseDoCronograma,
  atoPorCodigo: ReadonlyMap<string, AtoDoCatalogo>,
): readonly ProblemaDaFase[] {
  const problemas: ProblemaDaFase[] = [];

  if (fase.produtos.some((produto) => produto.atoCodigo === '')) {
    problemas.push({
      campo: 'produtos',
      mensagem: 'Escolha o tipo de ato de cada publicação declarada, ou remova a linha em branco.',
    });
  }

  const declarados = fase.produtos
    .map((produto) => produto.atoCodigo)
    .filter((codigo) => codigo !== '');
  if (new Set(declarados).size !== declarados.length) {
    problemas.push({
      campo: 'produtos',
      mensagem: 'A fase não pode declarar o mesmo tipo de ato mais de uma vez.',
    });
  }

  // O catálogo é quem diz se um ato é resultado, e é essa marca que decide se a
  // publicação pode receber papel. Ato que o catálogo carregado não conhece não
  // é acusado aqui: quem arbitra é o servidor, e recusar por desconhecimento
  // bloquearia a edição de um cronograma que ele aceita.
  for (const produto of fase.produtos) {
    if (produto.papel === null) continue;
    const ato = atoPorCodigo.get(produto.atoCodigo);
    if (ato !== undefined && !ato.ehResultado) {
      problemas.push({
        campo: 'produtos',
        mensagem: `A publicação ${ato.nome} não é resultado no catálogo e não recebe papel preliminar nem definitivo.`,
      });
    }
  }

  return problemas;
}

/**
 * A conclusão do ciclo recursal, como o agregado a confere.
 *
 * Fase que publica preliminar e a definitiva da matéria conclui a si mesma e
 * nada declara; fase que publica preliminar sem definitiva própria precisa
 * apontar quem a conclui, e essa fase tem de estar no cronograma, publicar
 * definitiva e vir depois dela. Declarar concluinte sem publicar preliminar não
 * descreve travessia nenhuma.
 */
function problemasDaConclusao(
  fase: FaseDoCronograma,
  fases: readonly FaseDoCronograma[],
): readonly ProblemaDaFase[] {
  const publicaPreliminar = produtosPreliminares(fase.produtos).length > 0;
  const declarada = fase.faseConcluinteCodigo;

  if (!publicaPreliminar) {
    return declarada === null
      ? []
      : [
          {
            campo: 'faseConcluinteCodigo',
            mensagem:
              'Só fase que publica resultado preliminar declara quem conclui o ciclo recursal dela.',
          },
        ];
  }

  if (declarada === null) {
    return publicaResultadoDefinitivo(fase.produtos)
      ? []
      : [
          {
            campo: 'faseConcluinteCodigo',
            mensagem:
              'A fase publica resultado preliminar e não publica o definitivo: declare qual fase conclui o ciclo recursal.',
          },
        ];
  }

  if (declarada === fase.codigo) {
    return [
      {
        campo: 'faseConcluinteCodigo',
        mensagem:
          'A fase não conclui a si mesma por declaração: para encerrar o próprio ciclo, ela publica o resultado definitivo.',
      },
    ];
  }

  const concluinte = fases.find((outra) => outra.codigo === declarada);
  if (concluinte === undefined) {
    return [
      {
        campo: 'faseConcluinteCodigo',
        mensagem: `A fase ${declarada} não está no cronograma e não pode concluir o ciclo recursal desta.`,
      },
    ];
  }

  if (!publicaResultadoDefinitivo(concluinte.produtos)) {
    return [
      {
        campo: 'faseConcluinteCodigo',
        mensagem: `A fase ${declarada} não publica resultado definitivo e não conclui o ciclo recursal desta.`,
      },
    ];
  }

  if (concluinte.ordem <= fase.ordem) {
    return [
      {
        campo: 'faseConcluinteCodigo',
        mensagem: `A fase ${declarada} vem antes desta na linha do tempo e não pode encerrar o ciclo recursal dela.`,
      },
    ];
  }

  return [];
}

function problemasDoParecer(fase: FaseDoCronograma): readonly ProblemaDaFase[] {
  if (!fase.emiteParecerIndividual) return [];
  const publicaResultado = fase.produtos.some((produto) => produto.papel !== null);

  return publicaResultado
    ? []
    : [
        {
          campo: 'emiteParecerIndividual',
          mensagem:
            'A fase promete parecer individual e não publica nenhum resultado. Declare a publicação, ou tire a promessa.',
        },
      ];
}

function problemasDoRecurso(fase: FaseDoCronograma): readonly ProblemaDaFase[] {
  const regra = fase.regraRecurso;
  if (regra === null) return [];

  const problemas: ProblemaDaFase[] = [];

  if (regra.regraCodigo === '') {
    problemas.push({
      campo: 'recurso.regra',
      mensagem: 'Escolha a regra que rege a contagem do prazo de recurso.',
    });
  }

  problemas.push(...problemasDoPrazo(regra.prazoValor, regra.prazoUnidade));
  problemas.push(...problemasDaAncoraDeclarada(fase));
  problemas.push(
    ...problemasDaSuspensividade(
      'recurso.suspensividadePrimeiraInstancia',
      'primeira instância',
      regra.suspensividadePrimeiraInstanciaValor,
      regra.suspensividadePrimeiraInstanciaUnidade,
    ),
  );
  problemas.push(
    ...problemasDaSuspensividade(
      'recurso.suspensividadeSegundaInstancia',
      'segunda instância',
      regra.suspensividadeSegundaInstanciaValor,
      regra.suspensividadeSegundaInstanciaUnidade,
    ),
  );

  return problemas;
}

/**
 * O prazo de interposição.
 *
 * Dia corrido é recusado pelo domínio, e a fração só existe em hora: um prazo em
 * dias úteis conta dias inteiros. Dizer isso aqui evita que o operador descubra
 * as duas coisas por uma gravação recusada.
 */
function problemasDoPrazo(valor: string, unidade: string): readonly ProblemaDaFase[] {
  const problemas: ProblemaDaFase[] = [];
  const numero = decimalDoCampo(valor);

  if (valor.trim() === '' || numero === null) {
    problemas.push({
      campo: 'recurso.prazo',
      mensagem: 'O prazo de interposição precisa ser um número, com ponto ou vírgula decimal.',
    });
  } else if (numero <= 0) {
    problemas.push({
      campo: 'recurso.prazo',
      mensagem: 'O prazo de interposição precisa ser maior que zero.',
    });
  }

  if (unidade === '' || unidade === 'nenhuma') {
    problemas.push({
      campo: 'recurso.prazo',
      mensagem: 'Declare a unidade do prazo de interposição: dias úteis ou horas.',
    });
  } else if (unidade === 'dias') {
    problemas.push({
      campo: 'recurso.prazo',
      mensagem: 'Prazo de interposição em dias corridos não é aceito. Use dias úteis ou horas.',
    });
  } else if (unidade === 'diasUteis' && numero !== null && !Number.isInteger(numero)) {
    problemas.push({
      campo: 'recurso.prazo',
      mensagem: 'Prazo de interposição em dias úteis exige valor inteiro.',
    });
  }

  return problemas;
}

/**
 * A âncora é escolhida, não derivada: uma fase publica legitimamente gabarito e
 * resultado preliminares e admite recurso contra qualquer um deles, e eleger um
 * em silêncio contaria a janela da publicação errada.
 */
function problemasDaAncoraDeclarada(fase: FaseDoCronograma): readonly ProblemaDaFase[] {
  const regra = fase.regraRecurso;
  if (regra === null) return [];

  const preliminares = produtosPreliminares(fase.produtos);
  if (preliminares.length === 0) {
    return [
      {
        campo: 'produtos',
        mensagem:
          'A fase admite recurso e não publica nenhum resultado preliminar. Declare a publicação preliminar de que cabe recurso.',
      },
    ];
  }

  if (regra.atoAncoraCodigo === '') {
    return [
      {
        campo: 'recurso.ancora',
        mensagem: 'Escolha a publicação preliminar de cuja divulgação corre o prazo de recurso.',
      },
    ];
  }

  return preliminares.some((produto) => produto.atoCodigo === regra.atoAncoraCodigo)
    ? []
    : [
        {
          campo: 'recurso.ancora',
          mensagem:
            'O prazo de recurso precisa contar de um resultado preliminar publicado por esta própria fase.',
        },
      ];
}

/**
 * O par de suspensividade é declarado inteiro ou deixado inteiro em branco:
 * metade preenchida é recusada, e a ausência dos dois é a desativação prevista
 * daquela instância.
 */
function problemasDaSuspensividade(
  campo: CampoDaFase,
  instancia: string,
  valor: string,
  unidade: string,
): readonly ProblemaDaFase[] {
  const temValor = valor.trim() !== '';
  const temUnidade = unidade !== '' && unidade !== 'nenhuma';

  if (!temValor && !temUnidade) return [];

  if (temValor !== temUnidade) {
    return [
      {
        campo,
        mensagem: `A suspensividade da ${instancia} exige valor e unidade juntos, ou nenhum dos dois.`,
      },
    ];
  }

  const numero = decimalDoCampo(valor);
  if (numero === null) {
    return [
      {
        campo,
        mensagem: `O prazo de suspensividade da ${instancia} precisa ser um número, com ponto ou vírgula decimal.`,
      },
    ];
  }

  return numero > 0
    ? []
    : [
        {
          campo,
          mensagem: `O prazo de suspensividade da ${instancia} precisa ser maior que zero.`,
        },
      ];
}

/**
 * As bancas requeridas e o recorte de competência de cada uma.
 *
 * O recorte só é obrigatório quando o mesmo tipo de banca aparece mais de uma
 * vez na fase — é ele que diz qual das duas julga o quê. Com uma banca só, o
 * recorte vazio significa "julga tudo o que a fase exige".
 */
function problemasDasBancas(
  fase: FaseDoCronograma,
  nomeDaBanca: (tipoBancaId: string) => string,
): readonly ProblemaDaFase[] {
  const problemas: ProblemaDaFase[] = [];

  if (fase.bancasRequeridas.some((banca) => banca.tipoBancaId === '')) {
    problemas.push({
      campo: 'bancasRequeridas',
      mensagem: 'Escolha o tipo de cada banca requerida, ou remova a linha em branco.',
    });
  }

  const porTipo = new Map<string, string[][]>();
  for (const banca of fase.bancasRequeridas) {
    if (banca.tipoBancaId === '') continue;
    const recortes = porTipo.get(banca.tipoBancaId) ?? [];
    recortes.push([...banca.categoriasDocumentoIds].sort());
    porTipo.set(banca.tipoBancaId, recortes);
  }

  for (const [tipoBancaId, recortes] of porTipo) {
    if (recortes.length === 1) continue;

    const nome = nomeDaBanca(tipoBancaId);
    if (recortes.some((recorte) => recorte.length === 0)) {
      problemas.push({
        campo: 'bancasRequeridas',
        mensagem: `A fase requer mais de uma banca de ${nome}: cada uma precisa declarar as categorias de documento que julga.`,
      });
      continue;
    }

    const assinaturas = recortes.map((recorte) => recorte.join('|'));
    if (new Set(assinaturas).size !== assinaturas.length) {
      problemas.push({
        campo: 'bancasRequeridas',
        mensagem: `Duas bancas de ${nome} declaram o mesmo recorte de competência — não haveria como saber qual julga o quê.`,
      });
    }
  }

  return problemas;
}

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
      mensagem: 'A fase declara o mesmo tipo de ato mais de uma vez.',
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
    const indice = indiceDaFaseEm(erro.field);
    const conhecido = MENSAGEM_POR_CODIGO.get(erro.code);
    const texto = conhecido?.mensagem ?? problema.title;

    if (indice === null || indice !== indiceDaFaseAberta) {
      const onde = indice === null ? 'No cronograma' : `Na fase ${nomeDaFase(indice)}`;
      gerais.push(`${onde}: ${texto}`);
      continue;
    }

    if (conhecido === undefined) {
      gerais.push(texto);
      continue;
    }

    // Uma fase mal declarada erra em vários itens da mesma coleção ao mesmo
    // tempo, e o campo é o mesmo para todos. A primeira é a que orienta.
    if (!porCampo.has(conhecido.campo)) porCampo.set(conhecido.campo, conhecido.mensagem);
  }

  return { porCampo, gerais };
}

/** A posição da fase no `field` da recusa, ou `null` quando ele não a nomeia. */
function indiceDaFaseEm(field: string): number | null {
  const casamento = /^fases\[(\d+)\]/.exec(field);
  if (casamento === null) return null;
  const indice = Number(casamento[1]);
  return Number.isInteger(indice) ? indice : null;
}

/** Como a tela nomeia o papel de uma publicação nos seletores. */
export const PAPEIS_ESCOLHIVEIS = [
  { valor: '', rotulo: 'Não é resultado' },
  { valor: PAPEL_PRELIMINAR, rotulo: 'Resultado preliminar' },
  { valor: PAPEL_DEFINITIVO, rotulo: 'Resultado definitivo' },
] as const;
