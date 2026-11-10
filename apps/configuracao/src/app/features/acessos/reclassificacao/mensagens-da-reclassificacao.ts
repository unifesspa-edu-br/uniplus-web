import type { MensagemDaRecusa } from '../mensagens-de-versao';

/** As recusas da reclassificação de permissão, com o que fazer a seguir, como nas páginas de erro do portal. */
export const MENSAGENS_DA_RECLASSIFICACAO: Readonly<Record<string, MensagemDaRecusa>> = {
  'reclassificacao.alvo_invalido': {
    titulo: 'A decisão não diz quais concessões decidir.',
    resolver:
      'Marque ao menos uma concessão ou escolha decidir todas as pendentes da etapa, sem combinar as duas.',
  },
  'reclassificacao.concessao_fora_da_reclassificacao': {
    titulo: 'Uma concessão não está mais suspensa por esta reclassificação.',
    resolver:
      'Recarregue a reclassificação para ver as concessões que ainda aguardam e decida de novo.',
  },
  'reclassificacao.decisor_e_beneficiario': {
    titulo: 'Ninguém decide a própria concessão.',
    resolver: 'Desmarque a sua concessão. Outra pessoa com a permissão da etapa a decide.',
  },
  'reclassificacao.documento_nao_lido': {
    titulo: 'O documento instituidor ainda não foi lido.',
    resolver:
      'Leia o documento de cada versão em uso, na seção das versões, e envie a decisão de novo.',
  },
  'reclassificacao.escopo_nao_comporta': {
    titulo: 'O escopo da concessão não comporta o novo alcance da permissão.',
    resolver:
      'Esta concessão não pode ser liberada pela gestão de acessos e só volta por pedido novo. Mantenha-a suspensa, com o motivo.',
  },
  'reclassificacao.etapa_invalida': {
    titulo: 'A etapa escolhida não existe nesta reclassificação.',
    resolver: 'Escolha a gestão de acessos ou a proteção de dados, conforme a sua permissão.',
  },
  'reclassificacao.etapa_ja_decidida': {
    titulo: 'A etapa já foi decidida para uma das concessões.',
    resolver:
      'Recarregue a reclassificação para ver o que já foi decidido. Nada do envio foi gravado.',
  },
  'reclassificacao.etapa_nao_exigida': {
    titulo: 'Esta etapa não é exigida para uma das concessões.',
    resolver:
      'A proteção de dados decide a subida de classe e a gestão de acessos decide a mudança de escopo. Recarregue e marque só as concessões que aguardam a sua etapa.',
  },
  'reclassificacao.mesmo_decisor_nas_duas_etapas': {
    titulo: 'Você já decidiu a outra etapa desta reclassificação.',
    resolver:
      'As duas etapas de uma concessão são decididas por pessoas diferentes. Peça a outra pessoa com a permissão da etapa que a decida.',
  },
  'reclassificacao.motivo_invalido': {
    titulo: 'O motivo para manter a suspensão está ausente ou passa de 500 caracteres.',
    resolver: 'Informe o motivo, que fica na trilha, em até 500 caracteres.',
  },
  'reclassificacao.nao_encontrada': {
    titulo: 'A reclassificação não foi encontrada.',
    resolver: 'Volte à fila e abra uma reclassificação que ainda aguarda a sua decisão.',
  },
  'reclassificacao.resultado_invalido': {
    titulo: 'O resultado da decisão é inválido.',
    resolver: 'Escolha liberar ou manter a suspensão.',
  },
  'reclassificacao.sem_permissao_na_etapa': {
    titulo: 'Falta a permissão da etapa para esta decisão.',
    resolver:
      'A proteção de dados decide a subida de classe e a gestão de acessos decide a mudança de escopo. Peça a uma pessoa com a permissão da etapa que decida.',
  },
  'reclassificacao.superada': {
    titulo: 'Esta reclassificação foi substituída por outra mais recente.',
    resolver:
      'Recarregue a fila, abra a reclassificação mais recente e decida por ela. Nada da decisão enviada foi gravado.',
  },
};
