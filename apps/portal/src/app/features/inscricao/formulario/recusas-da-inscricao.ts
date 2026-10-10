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
  'uniplus.selecao.inscricao.endereco_residencial_invalido':
    'O endereço não foi confirmado. Confira o CEP e a cidade.',
};

export function mensagemDaRecusa(codigo: string): string {
  return MENSAGENS[codigo] ?? 'Revise esta resposta.';
}
