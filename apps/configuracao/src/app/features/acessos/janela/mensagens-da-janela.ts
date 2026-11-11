import type { MensagemDaRecusa } from '../mensagens-de-versao';

/** As recusas da janela de migração, com o que fazer a seguir, como nas páginas de erro do portal. */
export const MENSAGENS_DA_JANELA: Readonly<Record<string, MensagemDaRecusa>> = {
  'migracao.concessao_fora_da_etapa': {
    titulo: 'A concessão não aguarda esta etapa.',
    resolver: 'Recarregue a janela para ver a situação de cada concessão e decida só as que aguardam a sua etapa.',
  },
  'migracao.concessao_ja_decidida': {
    titulo: 'A concessão já foi decidida na janela de migração.',
    resolver: 'Recarregue a janela para ver a decisão gravada. Quem foi recusado volta a ter o perfil por pedido novo, feito depois do fim da janela.',
  },
  'migracao.decisao_da_propria_concessao': {
    titulo: 'Ninguém decide a própria concessão.',
    resolver: 'Retire a própria concessão da decisão e peça a outra pessoa da gestão de acessos que decida a concessão retida.',
  },
  'migracao.exclusao_nao_confirmada': {
    titulo: 'A exclusão da lista exige confirmação.',
    resolver: 'Confirme que entende que as concessões recusadas, ou as que não foram migradas, serão revogadas.',
  },
  'migracao.janela_em_encerramento': {
    titulo: 'A janela de migração está sendo encerrada.',
    resolver: 'Repita o pedido em instantes. Quando o encerramento terminar, a resposta passa a refletir a situação final da janela.',
  },
  'migracao.janela_encerrada': {
    titulo: 'A janela de migração já terminou.',
    resolver: 'Recarregue a tela: as concessões já têm a situação final. Se alguém precisar do perfil, o caminho é o pedido de acesso.',
  },
  'migracao.janela_nao_encontrada': {
    titulo: 'O perfil não tem janela de migração aberta.',
    resolver: 'Confira o perfil. Se a janela já terminou, não há mais o que decidir: quem não foi migrado perdeu o acesso e volta por pedido novo.',
  },
  'migracao.lote_incompleto': {
    titulo: 'O lote não decide todas as concessões da versão anterior.',
    resolver: 'Recarregue a janela, decida cada concessão da lista, migrando ou recusando, e envie o lote completo. As concessões de quem envia ficam retidas para outra pessoa da gestão de acessos.',
  },
  'migracao.lote_invalido': {
    titulo: 'A lista de decisões é inválida.',
    resolver: 'Recarregue a janela e monte a lista de novo, com uma decisão por concessão, só de concessões do perfil que aguardam a etapa.',
  },
  'migracao.lote_ja_enviado': {
    titulo: 'O lote da gestão de acessos já foi enviado.',
    resolver: 'Recarregue a janela para ver as decisões do lote. O que ficou retido se decide pela concessão retida, e o que aguarda a proteção de dados, pela etapa dela.',
  },
  'migracao.lote_nao_enviado': {
    titulo: 'O lote da gestão de acessos ainda não foi enviado.',
    resolver: 'Aguarde o envio do lote por outra pessoa da gestão de acessos e recarregue a janela.',
  },
  'migracao.mesma_pessoa_nas_duas_etapas': {
    titulo: 'A mesma pessoa não decide as duas etapas.',
    resolver: 'Peça a outra pessoa com a permissão da etapa que decida a concessão.',
  },
  'migracao.motivo_invalido': {
    titulo: 'O motivo do encerramento está ausente ou passa de 500 caracteres.',
    resolver: 'Informe um motivo que explique o encerramento, dentro do limite de caracteres.',
  },
  'migracao.prazo_encerrado': {
    titulo: 'O prazo da janela de migração terminou.',
    resolver: 'Recarregue a tela para ver a situação final de cada concessão. Quem perdeu o acesso volta a tê-lo por pedido novo, feito depois do fim da janela.',
  },
  'migracao.sem_permissao_na_etapa': {
    titulo: 'Falta a permissão da etapa para esta decisão.',
    resolver: 'A gestão de acessos decide o lote, as retidas e o encerramento; a proteção de dados decide a etapa dela. Peça a uma pessoa com a permissão da etapa que faça a decisão.',
  },
  'pedido.perfil_em_janela_de_migracao': {
    titulo: 'O perfil está em janela de migração e não recebe pessoa nova até o fim dela.',
    resolver: 'Faça o pedido depois que a janela terminar, em até 72 horas corridas da abertura, ou antes, se todas as concessões forem decididas ou a gestão de acessos encerrar a janela.',
  },
  'perfil.janela_de_migracao_aberta': {
    titulo: 'O perfil tem janela de migração aberta e não aceita outra versão pendente.',
    resolver: 'Proponha a versão depois que a janela terminar. A remoção de permissão continua possível durante a janela e vale na hora, sem reiniciar o prazo.',
  },
};
