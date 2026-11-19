import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ProblemI18nService, type ProblemDetails } from '@uniplus/shared-core/http';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { MENSAGENS_DO_TERMO } from './mensagens-do-termo';

const CODIGOS = [
  'pedido.sem_termo_vigente',
  'pedido.termo_divergente',
  'pedido.apresentacao_do_termo_invalida',
  'pedido.anexo_nao_declarado',
  'pedido.termo_exigido',
  'termo.sem_versao_vigente',
  'termo.versao_nao_encontrada',
  'termo.texto_invalido',
  'termo.ato_invalido',
  'termo.texto_igual_ao_vigente',
  'termo.vigente_alterado',
  'termo.autor_nao_identificado',
];

describe('mensagens do termo de responsabilidade', () => {
  it('cobre os doze códigos do contrato, sem outros', () => {
    expect(Object.keys(MENSAGENS_DO_TERMO).sort()).toEqual([...CODIGOS].sort());
  });

  it('registra cada código no lugar do texto curto da API', () => {
    TestBed.configureTestingModule({ providers: [provideMensagensDeAcesso()] });
    const problemas = TestBed.inject(ProblemI18nService);
    for (const codigo of CODIGOS) {
      const problema: ProblemDetails = {
        type: 'x',
        title: 'texto curto',
        status: 422,
        code: `uniplus.autorizacao.${codigo}`,
        traceId: '',
      };
      expect(problemas.resolve(problema).title).toBe(MENSAGENS_DO_TERMO[codigo]?.titulo);
    }
  });
});
