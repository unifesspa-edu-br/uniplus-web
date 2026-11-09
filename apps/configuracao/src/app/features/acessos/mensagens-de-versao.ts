export interface MensagemDaRecusa {
  readonly titulo: string;
  readonly resolver: string;
}

/** As recusas da proposta, da remoção e da aprovação de versões de perfil, com o que fazer a seguir. */
export const MENSAGENS_DE_VERSAO: Readonly<Record<string, MensagemDaRecusa>> = {
  'perfil.acrescimo_com_concessao_ativa': {
    titulo: 'Há concessões ativas que não podem receber o acréscimo agora.',
    resolver: 'Aguarde a aprovação da versão ou ajuste o que é acrescentado.',
  },
  'perfil.ampliacao_exige_protecao_de_dados': {
    titulo: 'Acrescentar permissões sensíveis exige a aprovação da proteção de dados.',
    resolver: 'A versão segue para as duas etapas de aprovação.',
  },
  'perfil.aprovacoes_descartadas': {
    titulo: 'A versão mudou e as aprovações anteriores foram descartadas.',
    resolver: 'Atualize a tela e decida a versão de novo.',
  },
  'perfil.autor_nao_identificado': {
    titulo: 'Não foi possível identificar quem propôs a versão.',
    resolver: 'Entre de novo e repita a operação.',
  },
  'perfil.decisor_e_autor': {
    titulo: 'Quem propôs a versão não a aprova.',
    resolver: 'Outra pessoa com a mesma função precisa decidir esta versão.',
  },
  'perfil.documento_invalido': {
    titulo: 'O documento instituidor é inválido.',
    resolver: 'Envie um PDF de até 10 MB.',
  },
  'perfil.documento_nao_aguarda_envio': {
    titulo: 'A versão não aguarda o envio de um documento.',
    resolver: 'Atualize a tela para ver a situação do documento.',
  },
  'perfil.documento_nao_recusado': {
    titulo: 'O documento da versão não foi recusado na verificação.',
    resolver: 'Atualize a tela para ver a situação do documento.',
  },
  'perfil.documento_nao_verificado': {
    titulo: 'O documento instituidor ainda não foi verificado.',
    resolver: 'Aguarde a verificação. Se o documento foi recusado, envie outro arquivo.',
  },
  'perfil.etapa_invalida': {
    titulo: 'Esta versão aguarda a decisão de outra etapa.',
    resolver: 'Aguarde a versão chegar à sua fila.',
  },
  'perfil.etapa_ja_decidida': {
    titulo: 'Esta etapa já foi decidida.',
    resolver: 'Atualize a fila para ver a situação da versão.',
  },
  'perfil.inativo': {
    titulo: 'O perfil está desativado.',
    resolver: 'Reative o perfil antes de propor uma versão.',
  },
  'perfil.mesmo_decisor_nas_duas_etapas': {
    titulo: 'A mesma pessoa não decide as duas etapas.',
    resolver: 'A segunda etapa precisa ser decidida por outra pessoa da proteção de dados.',
  },
  'perfil.motivo_invalido': {
    titulo: 'O motivo é inválido.',
    resolver: 'Informe o motivo, em até 500 caracteres.',
  },
  'perfil.protocolo_invalido': {
    titulo: 'O protocolo do documento é inválido.',
    resolver: 'Informe o número de protocolo do documento instituidor.',
  },
  'perfil.remocao_invalida': {
    titulo: 'A remoção não vale para este perfil.',
    resolver: 'Escolha permissões que estejam na versão em vigor e informe a categoria.',
  },
  'perfil.sem_permissao_na_etapa': {
    titulo: 'Você não tem permissão para decidir esta etapa.',
    resolver: 'A decisão cabe a quem tem a permissão de aprovação da etapa.',
  },
  'perfil.sem_versao_em_vigor': {
    titulo: 'O perfil ainda não tem versão em vigor.',
    resolver: 'Não há o que remover. Aprove a primeira versão.',
  },
  'perfil.versao_expirada': {
    titulo: 'O prazo para decidir a versão venceu.',
    resolver: 'Proponha a versão de novo.',
  },
  'perfil.versao_nao_encontrada': {
    titulo: 'A versão não foi encontrada.',
    resolver: 'Atualize a tela. Ela pode ter sido decidida ou cancelada.',
  },
  'perfil.versao_nao_pendente': {
    titulo: 'A versão não está mais pendente.',
    resolver: 'Atualize a tela para ver a situação atual.',
  },
  'perfil.versao_pendente_existente': {
    titulo: 'O perfil já tem uma versão pendente de aprovação.',
    resolver: 'Aguarde a decisão ou cancele a versão pendente antes de propor outra.',
  },
};
