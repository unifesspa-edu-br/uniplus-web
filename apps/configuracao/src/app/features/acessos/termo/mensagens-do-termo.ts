import type { MensagemDaRecusa } from '../mensagens-de-versao';

/**
 * As recusas do termo de responsabilidade e da apresentação dele no pedido (UNI-REQ-0377 e
 * UNI-REQ-0378, ADR-0162), pelo código depois de `uniplus.autorizacao.`.
 */
export const MENSAGENS_DO_TERMO: Readonly<Record<string, MensagemDaRecusa>> = {
  'pedido.sem_termo_vigente': {
    titulo: 'Não há termo de responsabilidade publicado.',
    resolver:
      'O perfil pedido dá acesso a dado pessoal ou sensível e exige o aceite do termo, mas nenhuma versão foi publicada. Peça ao gestor de acessos que publique o termo.',
  },
  'pedido.termo_divergente': {
    titulo: 'O termo apresentado não é o vigente.',
    resolver: 'Leia o termo novamente e repita a operação.',
  },
  'pedido.apresentacao_do_termo_invalida': {
    titulo: 'Versão do termo ausente ou indevida.',
    resolver: 'Recarregue a página e repita a operação com a versão do termo que ela apresenta.',
  },
  'pedido.anexo_nao_declarado': {
    titulo: 'O pedido não declarou documento.',
    resolver:
      'O documento só se anexa ao pedido que declarou, na criação, que o anexaria. Cancele e refaça o pedido com o documento.',
  },
  'pedido.termo_exigido': {
    titulo: 'O perfil passou a exigir o termo de responsabilidade.',
    resolver:
      'O perfil passou a dar acesso a dado pessoal ou sensível depois da criação do pedido, que foi devolvido. Refaça o pedido para aceitar o termo.',
  },
  'termo.sem_versao_vigente': {
    titulo: 'Não há termo de responsabilidade publicado.',
    resolver:
      'Nenhuma versão do termo foi publicada até agora. Peça ao gestor de acessos que a publique.',
  },
  'termo.versao_nao_encontrada': {
    titulo: 'Versão do termo não encontrada.',
    resolver: 'A versão do termo informada não existe. Recarregue a página.',
  },
  'termo.texto_invalido': {
    titulo: 'Texto do termo inválido.',
    resolver:
      'O texto é obrigatório, tem entre 200 e 20 000 caracteres e não contém caractere de controle, além da quebra de linha e da tabulação.',
  },
  'termo.ato_invalido': {
    titulo: 'Ato de aprovação inválido.',
    resolver:
      'Informe o ato que aprova a versão, com até 500 caracteres e sem caractere de controle.',
  },
  'termo.texto_igual_ao_vigente': {
    titulo: 'O texto é igual ao da versão vigente.',
    resolver: 'Não há o que publicar: altere o texto antes de publicar uma versão nova.',
  },
  'termo.vigente_alterado': {
    titulo: 'Outra versão foi publicada antes.',
    resolver:
      'Outra versão do termo foi publicada depois que a tela foi aberta. Confira a versão vigente antes de publicar outra.',
  },
  'termo.autor_nao_identificado': {
    titulo: 'Autor da operação não identificado.',
    resolver:
      'Não foi possível identificar quem publica o termo; nada foi registrado. Saia e entre de novo.',
  },
};
