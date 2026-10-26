import { CLIENT_PROBLEM_CODES, type ProblemDetails } from '@uniplus/shared-core/http';

/** De onde a recusa veio: a geração do envio, a importação do retorno ou a abertura de um lote. */
export type ContextoDaRecusa = 'envio' | 'importacao' | 'lote';

/** O que a tela mostra de uma recusa: o que houve, o que fazer e quanto dela se sabe. */
export interface RecusaExplicada {
  readonly titulo: string;
  readonly explicacao: string;
  readonly orientacao: string;
  /** `warning` quando a recusa pede só que se espere algo acontecer, e não que se corrija algo. */
  readonly nivel: 'danger' | 'warning';
  /** A linha e a coluna que a API aponta, sem conteúdo do arquivo; nulo fora dos erros de estrutura. */
  readonly detalhe: string | null;
  /** O catálogo de leiautes mudou: a tela precisa relê-lo e limpar a escolha. */
  readonly recarregarCatalogo: boolean;
  /** Código para a equipe técnica, só quando a falha não é uma recusa da API. */
  readonly traceId: string | null;
}

const PREFIXO = 'uniplus.selecao.notas_do_enem.';
const PROCESSO_NAO_ENCONTRADO = 'uniplus.selecao.processo_seletivo.nao_encontrado';

const TITULO_DA_IMPORTACAO = 'Arquivo recusado: nenhuma nota foi gravada.';
const TITULOS: Readonly<Record<ContextoDaRecusa, string>> = {
  envio: 'Não foi possível gerar o arquivo de envio.',
  importacao: TITULO_DA_IMPORTACAO,
  lote: 'Não foi possível abrir o lote.',
};

interface Texto {
  readonly explicacao: string;
  readonly orientacao: string;
  readonly nivel?: 'warning';
  readonly detalhe?: true;
  readonly recarregarCatalogo?: true;
}

/** Com um só leiaute no catálogo não há o que conferir na escolha: o texto fala só do arquivo. */
const ARQUIVO_FORA_DO_LEIAUTE_COM_UM: Texto = {
  explicacao: 'O arquivo não confere com o leiaute.',
  orientacao: 'Envie o arquivo exatamente como o INEP o devolveu. Não o edite para fazê-lo passar.',
  detalhe: true,
};

export interface OpcoesDaRecusa {
  /** O catálogo oferece mais de um leiaute; sem isso, a recusa não manda conferir a escolha. */
  readonly variosLeiautes?: boolean;
}

const POR_CODIGO: Readonly<Record<string, Texto>> = {
  [`${PREFIXO}arquivo_fora_do_leiaute`]: {
    explicacao: 'O arquivo não confere com o leiaute escolhido.',
    orientacao:
      'Confira se o leiaute selecionado é o do arquivo e envie o arquivo exatamente como o INEP o devolveu. Não o edite para fazê-lo passar.',
    detalhe: true,
  },
  [`${PREFIXO}codigo_de_situacao_desconhecido`]: {
    explicacao: 'O arquivo traz um código de situação de prova que o leiaute não conhece.',
    orientacao: 'Não altere o arquivo. Informe à equipe técnica a linha e a coluna indicadas.',
    detalhe: true,
  },
  [`${PREFIXO}arquivo_vazio`]: {
    explicacao: 'O arquivo está vazio ou não foi enviado.',
    orientacao: 'Escolha o arquivo de retorno do INEP e tente de novo.',
  },
  [`${PREFIXO}arquivo_grande_demais`]: {
    explicacao: 'O arquivo passa de 10 MB.',
    orientacao: 'Confira se é o retorno do INEP deste processo. Se for, acione a equipe técnica.',
  },
  [`${PREFIXO}tipo_de_arquivo_nao_aceito`]: {
    explicacao: 'O arquivo não é de texto.',
    orientacao:
      'Envie o arquivo de texto como o INEP o devolveu, sem abri-lo e salvá-lo de novo numa planilha.',
  },
  [`${PREFIXO}leiaute_indisponivel`]: {
    explicacao: 'O leiaute escolhido não está mais disponível.',
    orientacao: 'A lista de leiautes foi atualizada. Escolha outro.',
    recarregarCatalogo: true,
  },
  [`${PREFIXO}edicao_nao_admitida`]: {
    explicacao: 'A edição não é uma das aceitas pelo edital divulgado.',
    orientacao:
      'O edital divulgado pode diferir da configuração em edição, se houver uma retificação em andamento. Escolha outra edição ou confira a divulgação.',
  },
  [`${PREFIXO}etapa_sem_nota_do_enem`]: {
    explicacao: 'A etapa não recebe a nota do ENEM no edital divulgado.',
    orientacao: 'Revise a configuração das etapas numa retificação.',
  },
  [`${PREFIXO}etapa_nao_encontrada`]: {
    explicacao: 'A etapa não existe na versão divulgada do edital.',
    orientacao:
      'Recarregue a página. Se persistir, o edital divulgado tem outra configuração de etapas.',
  },
  [`${PREFIXO}edicao_sem_inscritos`]: {
    explicacao: 'Nenhuma inscrição enviada escolheu esta edição.',
    orientacao: 'Gere o arquivo depois que os candidatos enviarem as inscrições.',
    nivel: 'warning',
  },
  [`${PREFIXO}oferta_de_inscricao_fora_do_edital`]: {
    explicacao: 'Há inscrição que concorre a um curso que o edital divulgado não oferta mais.',
    orientacao:
      'Confira a retificação que retirou o curso, recoloque-o por nova retificação, divulgue-a e importe o arquivo de novo.',
  },
  [`${PREFIXO}lote_nao_encontrado`]: {
    explicacao: 'O lote não foi encontrado.',
    orientacao: 'Recarregue o histórico.',
  },
  [PROCESSO_NAO_ENCONTRADO]: {
    explicacao: 'O processo ainda não tem edital divulgado.',
    orientacao: 'O envio e a importação só existem depois da divulgação.',
  },
};

const FORMULARIO_ILEGIVEL: Texto = {
  explicacao: 'O envio do formulário não pôde ser lido.',
  orientacao: 'Escolha o arquivo de novo e tente outra vez.',
};
const SEM_PERMISSAO: Texto = {
  explicacao: 'Você não tem permissão para esta operação.',
  orientacao: 'Se precisa dela, peça o acesso à equipe responsável.',
};
const ARQUIVO_GRANDE: Texto = POR_CODIGO[`${PREFIXO}arquivo_grande_demais`];
const TIPO_NAO_ACEITO: Texto = POR_CODIGO[`${PREFIXO}tipo_de_arquivo_nao_aceito`];

const ORIENTACAO_DA_INCERTEZA: Readonly<Record<ContextoDaRecusa, string>> = {
  importacao:
    'Não é possível afirmar se o arquivo foi importado. Confira o histórico de lotes antes de enviar de novo; reenviar o mesmo arquivo não duplica nada.',
  envio:
    'Cada geração fica registrada no histórico de envios. Confira-o antes de gerar outro arquivo.',
  lote: 'Tente de novo em instantes.',
};

/** Sem resposta ou com erro do servidor não se sabe se o pedido foi gravado. */
export function falhaIncerta(problem: ProblemDetails): boolean {
  return problem.status === 0 || problem.status >= 500;
}

/**
 * Explica uma recusa do envio ao INEP ou da importação das notas. O texto é próprio da tela e
 * estático: o `detail` da API só entra nos erros de estrutura, em que a página do erro garante que
 * ele traz linha e coluna sem conteúdo do arquivo.
 *
 * A ordem das decisões importa. Só a falta de resposta (rede fora, 5xx) deixa em aberto se a
 * operação aconteceu; qualquer recusa da API, mapeada ou não, é anterior a qualquer gravação.
 */
export function explicarRecusa(
  problem: ProblemDetails,
  contexto: ContextoDaRecusa,
  opcoes: OpcoesDaRecusa = {},
): RecusaExplicada {
  const mapeado =
    problem.code === `${PREFIXO}arquivo_fora_do_leiaute` && opcoes.variosLeiautes === false
      ? ARQUIVO_FORA_DO_LEIAUTE_COM_UM
      : POR_CODIGO[problem.code];
  if (mapeado !== undefined) return montar(mapeado, problem, contexto);

  const porStatus = textoPorStatus(problem.status, contexto);
  if (porStatus !== null) return montar(porStatus, problem, contexto);

  if (falhaIncerta(problem)) {
    return {
      titulo: 'Não foi possível concluir a operação.',
      explicacao: 'O servidor não respondeu como esperado.',
      orientacao: ORIENTACAO_DA_INCERTEZA[contexto],
      nivel: 'danger',
      detalhe: null,
      recarregarCatalogo: false,
      traceId: problem.traceId === '' ? null : problem.traceId,
    };
  }

  const doServidor =
    problem.code === CLIENT_PROBLEM_CODES.UNEXPECTED_RESPONSE ? null : problem.title;
  return montar(
    {
      explicacao: doServidor ?? 'A requisição foi recusada.',
      orientacao:
        contexto === 'importacao'
          ? 'Confira o leiaute escolhido e o arquivo. Se persistir, acione a equipe técnica.'
          : 'Se persistir, acione a equipe técnica.',
    },
    problem,
    contexto,
  );
}

function textoPorStatus(status: number, contexto: ContextoDaRecusa): Texto | null {
  if (status === 403) return SEM_PERMISSAO;
  if (contexto !== 'importacao') return null;
  if (status === 413) return ARQUIVO_GRANDE;
  if (status === 415) return TIPO_NAO_ACEITO;
  if (status === 400) return FORMULARIO_ILEGIVEL;
  return null;
}

function montar(
  texto: Texto,
  problem: ProblemDetails,
  contexto: ContextoDaRecusa,
): RecusaExplicada {
  const detalhe = texto.detalhe === true ? (problem.detail?.trim() ?? '') : '';
  return {
    titulo: tituloDe(texto, contexto),
    explicacao: texto.explicacao,
    orientacao: texto.orientacao,
    nivel: texto.nivel ?? 'danger',
    detalhe: detalhe === '' ? null : detalhe,
    recarregarCatalogo: texto.recarregarCatalogo === true,
    traceId: null,
  };
}

function tituloDe(texto: Texto, contexto: ContextoDaRecusa): string {
  if (texto.nivel === 'warning') return 'Não há o que enviar ao INEP.';
  return TITULOS[contexto];
}
