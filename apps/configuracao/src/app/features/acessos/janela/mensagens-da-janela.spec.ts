import { TestBed } from '@angular/core/testing';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';
import { provideMensagensDeAcesso, textoDaRecusa } from '../mensagens-de-acesso';
import { MENSAGENS_DA_JANELA } from './mensagens-da-janela';

// Códigos conferidos com o contrato vigente da API.
const CASOS = [
  ['pedido.perfil_em_revisao_das_concessoes', 'Faça o pedido depois que a revisão terminar'],
  ['perfil.revisao_das_concessoes_aberta', 'A remoção de permissão continua possível'],
  ['revisao_das_concessoes.concessao_fora_da_etapa', 'decida só as que aguardam a sua etapa'],
  ['revisao_das_concessoes.concessao_ja_decidida', 'ver a decisão gravada'],
  ['revisao_das_concessoes.decisao_da_propria_concessao', 'Retire a própria concessão'],
  ['revisao_das_concessoes.decisoes_incompletas', 'decida cada concessão da lista'],
  ['revisao_das_concessoes.decisoes_invalidas', 'uma decisão por concessão'],
  ['revisao_das_concessoes.decisoes_ja_enviadas', 'ver as decisões enviadas'],
  ['revisao_das_concessoes.decisoes_nao_enviadas', 'Aguarde o envio das decisões'],
  ['revisao_das_concessoes.exclusao_nao_confirmada', 'serão revogadas'],
  ['revisao_das_concessoes.mesma_pessoa_nas_duas_etapas', 'outra pessoa com a permissão da etapa'],
  ['revisao_das_concessoes.motivo_invalido', 'motivo que explique o encerramento'],
  ['revisao_das_concessoes.prazo_encerrado', 'situação final de cada concessão'],
  ['revisao_das_concessoes.revisao_em_encerramento', 'Repita o pedido em instantes'],
  ['revisao_das_concessoes.revisao_encerrada', 'as concessões já têm a situação final'],
  [
    'revisao_das_concessoes.revisao_nao_encontrada',
    'Confira se o perfil informado está em revisão',
  ],
  ['revisao_das_concessoes.sem_permissao_na_etapa', 'permissão da etapa que faça a decisão'],
] as const;

describe('recusas da revisão das concessões', () => {
  it.each(CASOS)('explica a recusa %s', (codigo, orientacao) => {
    TestBed.configureTestingModule({ providers: [provideMensagensDeAcesso()] });
    const problema = {
      type: 'x',
      title: 'Recusa genérica',
      status: 422,
      code: `uniplus.autorizacao.${codigo}`,
      traceId: '',
    };
    const texto = textoDaRecusa(TestBed.inject(ProblemI18nService).resolve(problema));
    expect(texto).toContain(orientacao);
    expect(texto).not.toContain('Recusa genérica');
  });

  it('reconhece exatamente os códigos do contrato', () => {
    expect(Object.keys(MENSAGENS_DA_JANELA)).toEqual(CASOS.map(([codigo]) => codigo));
  });
});
