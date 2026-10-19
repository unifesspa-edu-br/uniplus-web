/** O que dizer ao candidato ao lado da resposta que o servidor recusou, pelo código da recusa. */
const MENSAGENS: Readonly<Record<string, string>> = {
  'uniplus.selecao.inscricao.item_obrigatorio_ausente': 'Responda este campo.',
  'uniplus.selecao.inscricao.resposta_invalida': 'A resposta não atende a uma regra do campo.',
  'uniplus.selecao.inscricao.valor_fora_do_tipo':
    'A resposta não está no formato que o campo pede.',
  'uniplus.selecao.inscricao.fato_fora_do_formulario': 'Este campo não faz parte do formulário.',
  'uniplus.selecao.inscricao.impedimento': 'Esta resposta impede a inscrição.',
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
