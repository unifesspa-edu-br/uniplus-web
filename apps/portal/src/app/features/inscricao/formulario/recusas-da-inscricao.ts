import type { ProblemValidationError } from '@uniplus/shared-core/http';
import type { ErroDoServidor } from '@uniplus/shared-ui/components';

/**
 * As recusas de quem gravou sobre uma revisão defasada: outra janela gravou, ou a retificação trocou a
 * versão do formulário. A inscrição enviada noutra janela também é mudança que esta tela não viu:
 * relê-la troca o rascunho pela correção por novo envio.
 */
export const CONFLITOS: ReadonlySet<string> = new Set([
  'uniplus.selecao.inscricao.precondicao_falhou',
  'uniplus.selecao.inscricao.conflito_de_concorrencia',
  'uniplus.selecao.inscricao.rascunho_so_antes_do_envio',
]);

/** O campo em que o servidor devolve a recusa da oferta de curso. */
const CAMPO_DA_OFERTA = 'ofertaCursoId';
/** O campo em que o servidor devolve a recusa da 2ª opção de curso. */
const CAMPO_DA_SEGUNDA_OPCAO = 'ofertaCursoSegundaOpcaoId';
/** Recusas da 2ª opção que nascem da 1ª: trocar a 1ª as desfaz; as demais ficam até a 2ª mudar. */
export const RECUSAS_DA_SEGUNDA_QUE_VEM_DA_PRIMEIRA: ReadonlySet<string> = new Set([
  'uniplus.selecao.inscricao.segunda_opcao_igual_a_primeira',
  'uniplus.selecao.inscricao.segunda_opcao_sem_primeira',
]);

/** O que dizer ao candidato ao lado da resposta que o servidor recusou, pelo código da recusa. */
const MENSAGENS: Readonly<Record<string, string>> = {
  'uniplus.selecao.inscricao.item_obrigatorio_ausente': 'Responda este campo.',
  'uniplus.selecao.inscricao.resposta_invalida': 'A resposta não atende a uma regra do campo.',
  'uniplus.selecao.inscricao.valor_fora_do_tipo':
    'A resposta não está no formato que o campo pede.',
  'uniplus.selecao.inscricao.fato_fora_do_formulario': 'Este campo não faz parte do formulário.',
  'uniplus.selecao.inscricao.impedimento': 'Esta resposta impede a inscrição.',
  'uniplus.selecao.inscricao.documento_obrigatorio_ausente':
    'Envie este documento, ou uma das alternativas da lista, para concluir.',
  'uniplus.selecao.inscricao.termo_nao_aceito': 'Aceite o termo para concluir.',
  'uniplus.selecao.inscricao.grupo_contagem_invalida':
    'A quantidade informada não respeita o mínimo ou o máximo.',
  'uniplus.selecao.inscricao.grupo_candidato_ausente': 'Inclua você na lista.',
  'uniplus.selecao.inscricao.grupo_id_duplicado': 'Dois itens da lista têm a mesma identificação.',
  'uniplus.selecao.inscricao.data_nascimento_invalida': 'Informe uma data de nascimento válida.',
  'uniplus.selecao.inscricao.oferta_obrigatoria':
    'Escolha a oferta de curso para enviar a inscrição.',
  'uniplus.selecao.inscricao.oferta_fora_do_processo': 'Este curso não é oferecido neste processo.',
  'uniplus.selecao.inscricao.segunda_opcao_nao_admitida':
    'Este processo seletivo admite uma só opção de curso. Retire a 2ª opção.',
  'uniplus.selecao.inscricao.segunda_opcao_igual_a_primeira':
    'A 2ª opção tem de ser um curso diferente da 1ª.',
  'uniplus.selecao.inscricao.segunda_opcao_sem_primeira':
    'Escolha a 1ª opção antes da 2ª, ou retire a 2ª opção.',
  'uniplus.selecao.inscricao.endereco_residencial_invalido':
    'O endereço não foi confirmado. Confira o CEP e a cidade.',
  'uniplus.selecao.inscricao.nome_social_ausente_na_conta':
    'Você marcou que deseja usar nome social, mas sua conta não tem nome social cadastrado. Cadastre o nome social em Meu perfil ou desmarque a opção.',
};

export function mensagemDaRecusa(codigo: string): string {
  return MENSAGENS[codigo] ?? 'Revise esta resposta.';
}

/** O que dizer ao lado da 2ª opção de curso: a mensagem do código, ou a que fala da opção quando há. */
const MENSAGENS_DA_SEGUNDA_OPCAO: Readonly<Record<string, string>> = {
  'uniplus.selecao.inscricao.nenhuma_modalidade':
    'Com estas respostas, você não concorre a nenhuma modalidade da 2ª opção. Escolha outro curso ou retire a 2ª opção.',
  'uniplus.selecao.inscricao.modalidade_nao_decidida':
    'Ainda não é possível saber em quais modalidades você concorre na 2ª opção. Responda os campos indicados e envie de novo.',
};

export function mensagemDaRecusaDaSegundaOpcao(codigo: string): string {
  return MENSAGENS_DA_SEGUNDA_OPCAO[codigo] ?? mensagemDaRecusa(codigo);
}

/** As recusas do servidor separadas pelo lugar onde a tela as mostra. */
export interface RecusasSeparadas {
  /** As que apontam um campo do formulário. */
  readonly porCampo: readonly ErroDoServidor[];
  /** A mensagem da recusa da 1ª opção de curso, se houve. */
  readonly daOferta: string | null;
  /** A recusa da 2ª opção de curso, se houve. */
  readonly daSegunda: RecusaDaSegundaOpcao | null;
}

/** A mensagem da recusa da 2ª opção de curso e o código dela, que decide quando ela se desfaz. */
export interface RecusaDaSegundaOpcao {
  readonly mensagem: string;
  readonly codigo: string;
}

/** Separa as recusas do servidor entre as de campo e as das opções de curso. */
export function separarRecusas(recusas: readonly ProblemValidationError[]): RecusasSeparadas {
  const daOferta = recusas.find((e) => e.field === CAMPO_DA_OFERTA);
  const daSegunda = recusas.find((e) => e.field === CAMPO_DA_SEGUNDA_OPCAO);
  return {
    porCampo: recusas
      .filter((e) => e.field !== CAMPO_DA_OFERTA && e.field !== CAMPO_DA_SEGUNDA_OPCAO)
      .map((e) => ({ campo: e.field, mensagem: mensagemDaRecusa(e.code) })),
    daOferta: daOferta ? mensagemDaRecusa(daOferta.code) : null,
    daSegunda: daSegunda
      ? { mensagem: mensagemDaRecusaDaSegundaOpcao(daSegunda.code), codigo: daSegunda.code }
      : null,
  };
}
