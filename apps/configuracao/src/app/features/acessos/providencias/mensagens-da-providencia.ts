import type { MensagemDaRecusa } from '../mensagens-de-versao';

/** As recusas das providências sobre concessões, pelo código depois de `uniplus.autorizacao.`. */
export const MENSAGENS_DA_PROVIDENCIA: Readonly<Record<string, MensagemDaRecusa>> = {
  'providencia.nao_encontrada': {
    titulo: 'Providência não encontrada.',
    resolver: 'Volte à fila das providências e abra uma das que ela mostra.',
  },
  'providencia.tipo_invalido': {
    titulo: 'Tipo de providência inválido.',
    resolver: 'Escolha a retirada ou a revisão do acesso.',
  },
  'providencia.fundamento_invalido': {
    titulo: 'Fundamento da providência inválido.',
    resolver: 'Explique por que o acesso deve ser retirado ou revisto, entre 10 e 2000 caracteres.',
  },
  'providencia.motivo_invalido': {
    titulo: 'Motivo da resposta inválido.',
    resolver: 'Informe o motivo, em até 500 caracteres.',
  },
  'providencia.concessao_nao_ativa': {
    titulo: 'A concessão da providência já não está ativa.',
    resolver: 'Ela foi revogada ou venceu por outro caminho. A providência foi recarregada.',
  },
  'providencia.ja_ha_aberta': {
    titulo: 'Já existe providência aberta para a concessão.',
    resolver: 'Acompanhe a providência aberta na fila das providências.',
  },
  'providencia.ja_respondida': {
    titulo: 'A providência já foi respondida.',
    resolver: 'Outra pessoa respondeu antes de você. A providência foi recarregada.',
  },
  'providencia.ja_atendida': {
    titulo: 'A providência já foi atendida.',
    resolver: 'Outra pessoa a atendeu antes de você. A providência foi recarregada.',
  },
  'providencia.solicitante_nao_responde': {
    titulo: 'Quem solicitou a providência não a responde.',
    resolver: 'Outro gestor de acessos ou Representante do controlador precisa responder.',
  },
  'providencia.beneficiario_nao_responde': {
    titulo: 'O beneficiário da concessão não responde a providência.',
    resolver: 'Outro gestor de acessos ou Representante do controlador precisa responder.',
  },
  'providencia.autor_nao_identificado': {
    titulo: 'Autor da operação não identificado.',
    resolver: 'Entre de novo no sistema e repita a operação; nada foi registrado.',
  },
  'providencia.filtro_de_situacao_invalido': {
    titulo: 'Situação do filtro de providências inválida.',
    resolver: 'Escolha uma das situações que o filtro oferece.',
  },
};
