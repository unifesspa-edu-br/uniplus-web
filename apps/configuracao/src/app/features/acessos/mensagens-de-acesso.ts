import { type EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { ProblemI18nService } from '@uniplus/shared-core/http';

interface Mensagem {
  readonly titulo: string;
  readonly resolver: string;
}

const RAIZ = 'uniplus.autorizacao.';

/**
 * As recusas do fluxo de acesso com o que a pessoa faz a seguir, como nas páginas de erro do
 * portal. O título é o da recusa; o detalhe, a orientação.
 */
const MENSAGENS: Readonly<Record<string, Mensagem>> = {
  'pedido.anexo_invalido': {
    titulo: 'O documento anexo é inválido.',
    resolver: 'Envie um PDF de até 10 MB e confirme o envio de novo.',
  },
  'pedido.anexo_nao_verificado': {
    titulo: 'O documento ainda não foi verificado.',
    resolver: 'Aguarde a verificação. Se o documento foi recusado, envie outro arquivo.',
  },
  'pedido.beneficiario_invalido': {
    titulo: 'O e-mail do beneficiário não é institucional.',
    resolver: 'Informe o e-mail institucional da pessoa que vai receber o acesso.',
  },
  'pedido.beneficiario_sem_nome': {
    titulo: 'A conta do beneficiário não traz o nome completo.',
    resolver:
      'O beneficiário deve completar o nome na conta institucional, entrar de novo e repetir o pedido ou o aceite.',
  },
  'pedido.decisor_e_parte': {
    titulo: 'Quem decide não pode ser parte do pedido.',
    resolver: 'Outra pessoa com o mesmo papel precisa decidir este pedido.',
  },
  'pedido.escopo_invalido': {
    titulo: 'A unidade não combina com o perfil.',
    resolver:
      'Os perfis de governança valem para a instituição, sem unidade; os demais exigem uma unidade.',
  },
  'pedido.etapa_invalida': {
    titulo: 'Este pedido aguarda a decisão de outra etapa.',
    resolver: 'Aguarde o pedido chegar à sua fila.',
  },
  'pedido.ja_tem_concessao': {
    titulo: 'A pessoa já tem esse acesso.',
    resolver: 'Nenhuma ação é necessária. Recuse ou cancele o pedido.',
  },
  'pedido.justificativa_invalida': {
    titulo: 'A justificativa do pedido é inválida.',
    resolver: 'Explique a necessidade funcional do acesso, entre 10 e 2000 caracteres.',
  },
  'pedido.mesmo_decisor_nas_duas_etapas': {
    titulo: 'A mesma pessoa não decide as duas etapas.',
    resolver: 'A segunda etapa precisa ser decidida por outra encarregada de dados.',
  },
  'pedido.motivo_invalido': {
    titulo: 'O motivo da recusa é inválido.',
    resolver: 'Informe o motivo da recusa, em até 500 caracteres.',
  },
  'pedido.nao_e_o_beneficiario': {
    titulo: 'Só o beneficiário aceita o pedido.',
    resolver: 'Entre com a conta institucional do beneficiário para aceitar o pedido.',
  },
  'pedido.nao_encontrado': {
    titulo: 'O pedido não foi encontrado.',
    resolver: 'Confira o pedido na sua lista de pedidos.',
  },
  'pedido.pedido_duplicado': {
    titulo: 'Já existe um pedido igual em andamento.',
    resolver: 'Acompanhe o pedido que já existe, ou cancele-o antes de pedir de novo.',
  },
  'pedido.perfil_alterado': {
    titulo: 'O perfil mudou durante a análise.',
    resolver: 'O pedido voltou ao gestor de acessos. Aguarde uma nova decisão.',
  },
  'pedido.perfil_inativo': {
    titulo: 'O perfil de acesso está desativado.',
    resolver: 'Escolha um perfil ativo ou peça ao gestor de acessos que reative o perfil.',
  },
  'pedido.solicitante_nao_institucional': {
    titulo: 'O e-mail da sessão não é institucional verificado.',
    resolver:
      'Entre com a conta institucional para listar os perfis e pedir acesso a outra pessoa; o pedido para si também exige o e-mail institucional.',
  },
  'pedido.situacao_invalida': {
    titulo: 'A ação não vale para a situação atual do pedido.',
    resolver: 'Consulte a situação do pedido. Se ele foi encerrado, faça um novo pedido.',
  },
  'pedido.unidade_inexistente': {
    titulo: 'A unidade não foi encontrada.',
    resolver: 'Confira a unidade no cadastro da organização institucional.',
  },
  'concessao.confirmacao_divergente': {
    titulo: 'O e-mail informado não é o do beneficiário desta concessão.',
    resolver: 'Digite o e-mail institucional do beneficiário, como consta no pedido de acesso.',
  },
  'concessao.ja_revogada': {
    titulo: 'A concessão já foi revogada.',
    resolver: 'Nenhuma ação é necessária. Se a pessoa precisar do acesso, faça um novo pedido.',
  },
  'concessao.minimo_de_gestores': {
    titulo: 'A instituição precisa de ao menos dois gestores de acessos.',
    resolver:
      'Conceda o perfil de gestor de acessos a outra pessoa antes de revogar esta concessão.',
  },
  'concessao.motivo_invalido': {
    titulo: 'O motivo da revogação é inválido.',
    resolver: 'Informe por que o acesso está sendo retirado, em até 500 caracteres.',
  },
  'concessao.nao_encontrada': {
    titulo: 'A concessão não foi encontrada.',
    resolver: 'Confira a concessão na lista e tente de novo.',
  },
  'perfil.nome_duplicado': {
    titulo: 'Já existe um perfil com esse nome.',
    resolver: 'Escolha outro nome para o perfil.',
  },
  'perfil.governanca_imutavel': {
    titulo: 'Perfil de governança não se altera.',
    resolver: 'Os perfis de gestor de acessos e de encarregada de dados são fixos.',
  },
};

/** Registra as mensagens do fluxo de acesso no lugar do texto curto da API. */
export function provideMensagensDeAcesso(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const problemas = inject(ProblemI18nService);
    for (const [sufixo, { titulo, resolver }] of Object.entries(MENSAGENS)) {
      problemas.register(RAIZ + sufixo, { title: titulo, detail: resolver });
    }
  });
}

/** Título e orientação juntos, para quem exibe uma única linha. */
export function textoDaRecusa(mensagem: { title: string; detail?: string }): string {
  return mensagem.detail ? `${mensagem.title} ${mensagem.detail}` : mensagem.title;
}

/** Falha que não veio da API (rede interrompida, resposta ilegível): a tela libera a ação e explica. */
export const FALHA_INESPERADA =
  'Não foi possível concluir a operação. Verifique a conexão e tente de novo.';
