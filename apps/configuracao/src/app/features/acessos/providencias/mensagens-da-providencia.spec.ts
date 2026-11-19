import { TestBed } from '@angular/core/testing';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { tipoDeEvento } from '../rotulos-de-acesso';
import { MENSAGENS_DA_PROVIDENCIA } from './mensagens-da-providencia';

const CODIGOS = [
  'nao_encontrada',
  'tipo_invalido',
  'fundamento_invalido',
  'motivo_invalido',
  'concessao_nao_ativa',
  'ja_ha_aberta',
  'ja_respondida',
  'ja_atendida',
  'solicitante_nao_responde',
  'beneficiario_nao_responde',
  'autor_nao_identificado',
  'filtro_de_situacao_invalido',
];

describe('mensagens da providência', () => {
  it('cobre os doze códigos do contrato', () => {
    expect(Object.keys(MENSAGENS_DA_PROVIDENCIA).sort()).toEqual(
      CODIGOS.map((c) => `providencia.${c}`).sort(),
    );
  });

  it.each(CODIGOS)('registra %s no lugar do texto curto da API', (codigo) => {
    TestBed.configureTestingModule({ providers: [provideMensagensDeAcesso()] });
    const mensagem = TestBed.inject(ProblemI18nService).resolve({
      type: 'x',
      title: 'texto da API',
      status: 422,
      code: `uniplus.autorizacao.providencia.${codigo}`,
      traceId: '',
    });

    expect(mensagem.title).toBe(MENSAGENS_DA_PROVIDENCIA[`providencia.${codigo}`].titulo);
  });

  it('a trilha da concessão nomeia os quatro eventos novos como o contrato', () => {
    expect(
      ['providencia_solicitada', 'providencia_respondida', 'providencia_atendida', 'vencida'].map(
        tipoDeEvento,
      ),
    ).toEqual([
      'Providência solicitada',
      'Providência respondida',
      'Providência atendida',
      'Concessão vencida',
    ]);
  });
});
