import type { MensagemDaRecusa } from '../mensagens-de-versao';

export const MENSAGENS_DA_JANELA: Readonly<Record<string, MensagemDaRecusa>> = {
  'pedido.perfil_em_revisao_das_concessoes': {
    titulo:
      'O perfil está em revisão das concessões: o pedido só pode ser feito depois que ela terminar.',
    resolver:
      'Faça o pedido depois que a revisão terminar, em até 72 horas corridas da abertura, ou antes, se todas as concessões forem decididas ou a gestão de acessos encerrar a revisão.',
  },
  'perfil.revisao_das_concessoes_aberta': {
    titulo: 'O perfil tem revisão das concessões aberta: nova versão só depois que ela terminar.',
    resolver:
      'Proponha a versão depois que a revisão terminar. A remoção de permissão continua possível durante a revisão e vale na hora, sem reiniciar o prazo.',
  },
  'revisao_das_concessoes.concessao_fora_da_etapa': {
    titulo: 'A concessão não aguarda esta etapa.',
    resolver:
      'Recarregue a revisão para ver a situação de cada concessão e decida só as que aguardam a sua etapa.',
  },
  'revisao_das_concessoes.concessao_ja_decidida': {
    titulo: 'A concessão já foi decidida.',
    resolver:
      'Recarregue a revisão para ver a decisão gravada. Quem foi recusado volta a ter o perfil por pedido novo, feito depois do fim da revisão.',
  },
  'revisao_das_concessoes.decisao_da_propria_concessao': {
    titulo: 'Ninguém decide a própria concessão.',
    resolver:
      'Retire a própria concessão da decisão e peça a outra pessoa da gestão de acessos que decida a concessão retida.',
  },
  'revisao_das_concessoes.decisoes_incompletas': {
    titulo: 'O envio não decide todas as concessões da versão anterior.',
    resolver:
      'Recarregue a revisão, decida cada concessão da lista, migrando ou recusando, e envie as decisões novamente. As concessões de quem envia ficam retidas para outra pessoa da gestão de acessos.',
  },
  'revisao_das_concessoes.decisoes_invalidas': {
    titulo: 'Decisões inválidas.',
    resolver:
      'Recarregue a revisão e monte a lista de novo, com uma decisão por concessão, só de concessões do perfil que aguardam a etapa.',
  },
  'revisao_das_concessoes.decisoes_ja_enviadas': {
    titulo: 'As decisões já foram enviadas para esta revisão.',
    resolver:
      'Recarregue a revisão para ver as decisões enviadas. Outra pessoa da gestão de acessos decide as concessões retidas, e o Representante do controlador decide as que aguardam a etapa de proteção de dados.',
  },
  'revisao_das_concessoes.decisoes_nao_enviadas': {
    titulo: 'As decisões da gestão de acessos ainda não foram enviadas.',
    resolver:
      'Aguarde o envio das decisões por outra pessoa da gestão de acessos e recarregue a revisão. Se a concessão não constar da lista, ela não depende de decisão.',
  },
  'revisao_das_concessoes.exclusao_nao_confirmada': {
    titulo: 'A exclusão da lista exige confirmação.',
    resolver:
      'Repita a decisão confirmando que entende que as concessões recusadas, ou as que não foram migradas, serão revogadas.',
  },
  'revisao_das_concessoes.mesma_pessoa_nas_duas_etapas': {
    titulo: 'A mesma pessoa não decide as duas etapas.',
    resolver: 'Peça a outra pessoa com a permissão da etapa que decida a concessão.',
  },
  'revisao_das_concessoes.motivo_invalido': {
    titulo: 'Motivo ausente ou longo demais.',
    resolver:
      'Informe um motivo que explique o encerramento, dentro do limite de caracteres, e repita o pedido.',
  },
  'revisao_das_concessoes.prazo_encerrado': {
    titulo: 'O prazo da revisão das concessões terminou.',
    resolver:
      'Recarregue a tela para ver a situação final de cada concessão. Quem perdeu o acesso volta a tê-lo por pedido novo, feito depois do fim da revisão.',
  },
  'revisao_das_concessoes.revisao_em_encerramento': {
    titulo: 'A revisão das concessões está sendo encerrada; repita a operação.',
    resolver:
      'Repita o pedido em instantes. Quando o encerramento terminar, a resposta passa a refletir a situação final da revisão.',
  },
  'revisao_das_concessoes.revisao_encerrada': {
    titulo: 'A revisão das concessões já terminou.',
    resolver:
      'Recarregue a tela: as concessões já têm a situação final. Se alguém precisar do perfil, o caminho é o pedido de acesso.',
  },
  'revisao_das_concessoes.revisao_nao_encontrada': {
    titulo: 'Revisão das concessões não encontrada.',
    resolver:
      'Confira se o perfil informado está em revisão. Se a revisão já terminou, não há mais o que decidir: quem não foi migrado perdeu o acesso e volta por pedido novo.',
  },
  'revisao_das_concessoes.sem_permissao_na_etapa': {
    titulo: 'Acesso negado: a operação exige a permissão da etapa.',
    resolver:
      'A gestão de acessos decide o envio, as retidas e o encerramento; o Representante do controlador decide a etapa de proteção de dados. Peça a uma pessoa com a permissão da etapa que faça a decisão.',
  },
};
