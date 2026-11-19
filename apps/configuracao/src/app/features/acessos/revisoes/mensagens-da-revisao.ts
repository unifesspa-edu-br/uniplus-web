import type { MensagemDaRecusa } from '../mensagens-de-versao';

/** As recusas da revisão periódica de acessos, pelo código depois de `uniplus.autorizacao.`. */
export const MENSAGENS_DA_REVISAO: Readonly<Record<string, MensagemDaRecusa>> = {
  'revisao.nao_encontrada': {
    titulo: 'A revisão de acessos não foi encontrada.',
    resolver: 'Volte à lista e abra uma das revisões que ela mostra.',
  },
  'revisao.item_nao_encontrado': {
    titulo: 'O item não pertence a esta revisão.',
    resolver: 'Recarregue a revisão e decida um dos itens que ela mostra.',
  },
  'revisao.ja_ha_em_andamento': {
    titulo: 'Já existe revisão de acessos em andamento.',
    resolver: 'Conclua a revisão aberta, que está na lista, antes de abrir outra.',
  },
  'revisao.item_ja_decidido': {
    titulo: 'O item da revisão já foi decidido.',
    resolver:
      'Outra pessoa decidiu o item antes de você. A revisão foi recarregada com a decisão gravada.',
  },
  'revisao.concessao_nao_ativa': {
    titulo: 'A concessão do item já não está ativa.',
    resolver: 'Ela foi revogada ou venceu fora da revisão. A revisão foi recarregada.',
  },
  'revisao.decisor_e_beneficiario': {
    titulo: 'Ninguém decide o item da própria concessão.',
    resolver: 'Peça a outra pessoa com a permissão de decidir o item.',
  },
  'revisao.decisor_nao_decide_o_item': {
    titulo: 'O item cabe à outra governança.',
    resolver:
      'Quem decide o item mudou durante a revisão. O item foi recarregado e mostra quem o decide agora.',
  },
  'revisao.identidade_incompleta': {
    titulo: 'O seu acesso não traz a identidade completa.',
    resolver: 'Saia e entre de novo no sistema.',
  },
  'revisao.autor_nao_identificado': {
    titulo: 'Não foi possível identificar quem fez a operação.',
    resolver: 'Saia e entre de novo no sistema e repita a operação.',
  },
};
