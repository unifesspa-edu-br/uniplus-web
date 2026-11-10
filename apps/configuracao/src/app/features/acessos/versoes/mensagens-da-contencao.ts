import type { MensagensDoContexto } from '../falha-de-servidor';
import type { MensagemDaRecusa } from '../mensagens-de-versao';

/** As recusas da suspensão, da retomada, da desativação e da reativação do perfil, com o que fazer a seguir. */
export const MENSAGENS_DA_CONTENCAO: Readonly<Record<string, MensagemDaRecusa>> = {
  'perfil.ja_suspenso': {
    titulo: 'O perfil já está suspenso.',
    resolver:
      'Consulte o perfil para ver desde quando está suspenso. A suspensão que existe continua valendo até a retomada, e o motivo enviado agora não foi gravado.',
  },
  'perfil.nao_suspenso': {
    titulo: 'O perfil não está suspenso.',
    resolver:
      'Recarregue o perfil para ver a situação atual. Se ele já voltou a valer, nada mais é preciso.',
  },
  'perfil.retomada_por_quem_suspendeu': {
    titulo: 'Quem suspendeu o perfil não decide a retomada.',
    resolver: 'Peça a outra pessoa com a permissão da etapa que decida a retomada.',
  },
  'perfil.etapa_da_retomada_ja_decidida': {
    titulo: 'A etapa da retomada já foi decidida.',
    resolver:
      'Consulte o perfil para ver quais etapas faltam. A outra etapa é decidida por outra pessoa com a permissão dela.',
  },
  'perfil.reativacao_por_quem_desativou': {
    titulo: 'Quem desativou o perfil não o reativa.',
    resolver: 'Peça a outra pessoa da gestão de acessos que reative o perfil, informando o motivo.',
  },
};

/**
 * Códigos que a API reaproveita na retomada da suspensão e que, no registro geral, falam da versão
 * do perfil. Na retomada, o texto vale para a etapa da retomada.
 */
export const MENSAGENS_DA_RETOMADA: MensagensDoContexto = {
  'uniplus.autorizacao.perfil.etapa_invalida': {
    title: 'O perfil não exige essa etapa da retomada agora.',
    detail: 'Recarregue o perfil para ver as etapas que a retomada exige no momento.',
  },
  'uniplus.autorizacao.perfil.mesmo_decisor_nas_duas_etapas': {
    title: 'Você já decidiu a outra etapa da retomada.',
    detail:
      'As duas etapas são decididas por pessoas diferentes. Peça a outra pessoa com a permissão da etapa que a decida.',
  },
  'uniplus.autorizacao.perfil.sem_permissao_na_etapa': {
    title: 'Falta a permissão da etapa da retomada.',
    detail:
      'Peça à gestão de acessos que confira os perfis da sua conta, ou encaminhe a retomada a quem tenha a permissão da etapa.',
  },
};
