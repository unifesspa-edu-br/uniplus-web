export interface MensagemDaRecusa {
  readonly titulo: string;
  readonly resolver: string;
}

/** As recusas da proposta, da remoção e da aprovação de versões de perfil, com o que fazer a seguir. */
export const MENSAGENS_DE_VERSAO: Readonly<Record<string, MensagemDaRecusa>> = {
  'perfil.acrescimo_com_concessao_ativa': {
    titulo: 'A versão acrescenta permissão a um perfil que tem concessão não revogada.',
    resolver: 'Crie um perfil novo com a permissão e peça a concessão dele pelo fluxo de pedido. Se todas as concessões do perfil forem revogadas, a versão pode ser proposta. Mudanças só de nome, descrição ou documento não são afetadas.',
  },
  'perfil.ampliacao_exige_protecao_de_dados': {
    titulo: 'A versão acrescenta permissão pessoal ou sensível a um perfil com concessão ativa.',
    resolver: 'Para dar a permissão hoje, crie um perfil novo com ela e peça a concessão pelo fluxo de pedido, que passa pela proteção de dados. Se a mudança for só de nome, descrição, documento ou remoção de permissão, proponha a versão sem acrescentar essa permissão.',
  },
  'perfil.aprovacoes_descartadas': {
    titulo: 'A classificação de uma permissão acrescentada mudou, e as aprovações já dadas foram descartadas. A decisão pedida não foi registrada.',
    resolver: 'Consulte a versão, veja as etapas que ela exige agora e decida de novo, na ordem.',
  },
  'perfil.autor_nao_identificado': {
    titulo: 'A sessão não trouxe a identificação de quem age, e nada foi registrado.',
    resolver: 'Saia e entre de novo no sistema e repita a operação. Se o erro continuar, procure o suporte do CTIC.',
  },
  'perfil.decisor_e_autor': {
    titulo: 'Quem criou a versão não pode aprová-la nem recusá-la.',
    resolver: 'Peça a outra pessoa com a permissão da etapa que decida a versão.',
  },
  'perfil.documento_invalido': {
    titulo: 'O tamanho declarado do documento ou o identificador de envio (ETag) não é válido.',
    resolver: 'Use um arquivo PDF de até 10 MB e declare o tamanho real dele. Se o erro vier na confirmação do envio, repita o envio do arquivo.',
  },
  'perfil.documento_nao_aguarda_envio': {
    titulo: 'O documento da versão já foi enviado e não aguarda mais o arquivo.',
    resolver: 'Consulte a situação do documento. Em verificação, aguarde o resultado; verificado, use o documento existente; recusado, envie outro documento.',
  },
  'perfil.documento_nao_recusado': {
    titulo: 'O documento atual da versão não foi recusado na verificação, e só um documento recusado é substituído.',
    resolver: 'Consulte a situação do documento. Se aguarda envio, conclua o envio; em verificação, aguarde o resultado; verificado, use o documento existente.',
  },
  'perfil.documento_nao_verificado': {
    titulo: 'O documento da versão ainda não passou pela verificação.',
    resolver: 'Consulte a situação do documento. Se aguarda envio, conclua o envio; em verificação, aguarde o resultado; recusado, envie outro documento.',
  },
  'perfil.etapa_invalida': {
    titulo: 'A decisão foi pedida para uma etapa que a versão não aguarda agora.',
    resolver: 'Consulte a versão para ver qual etapa ela aguarda. Se não for a sua, aguarde a versão chegar à sua fila.',
  },
  'perfil.etapa_ja_decidida': {
    titulo: 'A etapa já tem decisão para esta versão, dada por outra pessoa ou por uma requisição anterior.',
    resolver: 'Consulte a versão para ver o resultado da etapa. Se ela foi recusada e a mudança ainda for necessária, proponha uma versão nova.',
  },
  'perfil.inativo': {
    titulo: 'O perfil está desativado e não aceita versão nova.',
    resolver: 'Reative o perfil e proponha a versão em seguida.',
  },
  'perfil.mesmo_decisor_nas_duas_etapas': {
    titulo: 'Você já decidiu a outra etapa desta versão. As duas etapas são decididas por pessoas diferentes.',
    resolver: 'Peça a outra pessoa com a permissão da etapa que decida a versão.',
  },
  'perfil.motivo_invalido': {
    titulo: 'O motivo está ausente, só com espaços ou passa de 500 caracteres.',
    resolver: 'Informe um motivo objetivo, de até 500 caracteres, sem dado pessoal, e repita a operação.',
  },
  'perfil.protocolo_invalido': {
    titulo: 'O protocolo do processo administrativo está em branco ou passa de 60 caracteres.',
    resolver: 'Informe o protocolo do processo administrativo, com até 60 caracteres, e envie de novo.',
  },
  'perfil.remocao_invalida': {
    titulo: 'A lista de permissões a remover está vazia, traz permissão que o perfil não tem na versão em vigor ou uma categoria não prevista.',
    resolver: 'Consulte a versão em vigor, informe ao menos uma permissão que ela tenha e, se indicar a categoria, escolha incidente, erro de composição ou mudança de função.',
  },
  'perfil.sem_permissao_na_etapa': {
    titulo: 'Falta a permissão de aprovação da etapa, necessária para decidir a versão, ver a fila ou ler o documento.',
    resolver: 'Peça à gestão de acessos que confira os perfis da sua conta. Se a operação não for da sua função, encaminhe a versão a quem tenha a permissão.',
  },
  'perfil.sem_versao_em_vigor': {
    titulo: 'O perfil ainda não tem versão em vigor, então não há permissão a remover.',
    resolver: 'Aguarde a aprovação da versão do perfil. Se a versão pendente não deve valer, peça o cancelamento dela.',
  },
  'perfil.versao_expirada': {
    titulo: 'A versão passou de 15 dias aguardando aprovação e expirou sem entrar em vigor.',
    resolver: 'Proponha uma versão nova do perfil, com o documento instituidor, e acompanhe a aprovação antes que o prazo vença.',
  },
  'perfil.versao_nao_encontrada': {
    titulo: 'Não há versão com o identificador informado para esse perfil.',
    resolver: 'Confira o identificador na lista de versões do perfil e repita a operação com uma versão que exista.',
  },
  'perfil.versao_nao_pendente': {
    titulo: 'A versão já foi decidida, cancelada ou substituída, e a operação só se aplica a uma versão pendente.',
    resolver: 'Consulte a situação da versão. Se a mudança ainda for necessária, proponha uma versão nova.',
  },
  'perfil.versao_pendente_existente': {
    titulo: 'O perfil já tem uma versão aguardando aprovação.',
    resolver: 'Decida ou cancele a versão pendente e, depois, proponha a versão nova.',
  },
};
