import { UnidadePrazoCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import type { FaseDoCronograma, RecursoDaFase } from '../../processo-seletivo.models';
import type { CampoDaFase } from './configuracao-da-fase';
import { conferir, fase, recurso } from './configuracao-da-fase.testing';

describe('regra de recurso', () => {
  const comPreliminar = (parcial: Partial<RecursoDaFase> = {}): FaseDoCronograma =>
    fase({
      produtos: [
        { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
        { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
      ],
      regraRecurso: recurso(parcial),
    });

  it('regra completa e coerente não relata problema', () => {
    expect(conferir(comPreliminar())).toEqual([]);
  });

  /**
   * O web não confere prazo, efeito suspensivo nem guarda da vaga: o valor lido é preservado e
   * enviado, e quem recusa é a API.
   */
  it.each([
    ['prazo em dias corridos', { prazoUnidade: UnidadePrazoCodigo.DIAS }],
    ['fração de dia útil', { prazoValor: '1,5' }],
    ['prazo zero', { prazoValor: '0' }],
    ['prazo em branco', { prazoValor: '' }],
    ['unidade em branco', { prazoUnidade: '' as const }],
    ['efeito suspensivo em branco', { efeitoSuspensivo: '' as const }],
    ['guarda da vaga em branco', { guardaDaVaga: '' as const }],
    ['prazo da 2ª instância só com valor', { prazoSegundaInstanciaUnidade: '' as const }],
  ])('não confere localmente: %s', (_nome, parcial) => {
    expect(conferir(comPreliminar(parcial))).toEqual([]);
  });

  it('cobra a regra de contagem escolhida no catálogo', () => {
    const problemas = conferir(comPreliminar({ regraCodigo: '' }));

    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.regra');
  });

  it('cobra a resposta sobre a instância superior', () => {
    const problemas = conferir(comPreliminar({ admiteInstanciaSuperior: null }));

    expect(problemas).toEqual([
      {
        campo: 'recurso.admiteInstanciaSuperior',
        mensagem: 'Responda se o recurso admite instância superior.',
      },
    ]);
  });

  it('não cobra a instância superior respondida, seja qual for a resposta', () => {
    for (const admite of [true, false]) {
      expect(conferir(comPreliminar({ admiteInstanciaSuperior: admite }))).toEqual([]);
    }
  });

  it('cobra a publicação preliminar de que cabe recurso quando a fase não publica nenhuma', () => {
    const problemas = conferir(fase({ regraRecurso: recurso() }));

    expect(problemas[0].campo).toBe<CampoDaFase>('produtos');
  });

  it('cobra a âncora quando a fase publica dois preliminares e nenhum foi escolhido', () => {
    const problemas = conferir(
      fase({
        produtos: [
          { atoCodigo: 'GABARITO_PRELIMINAR', papel: 'PRELIMINAR' },
          { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
        ],
        regraRecurso: recurso({ atoAncoraCodigo: '' }),
      }),
    );

    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.ancora');
  });

  it('recusa a âncora que não é um resultado preliminar da própria fase', () => {
    const problemas = conferir(comPreliminar({ atoAncoraCodigo: 'COMUNICADO' }));

    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.ancora');
    expect(problemas[0].mensagem).toContain('publicado por esta própria fase');
  });

  it('fase sem regra de recurso não relata problema do recurso', () => {
    expect(conferir(fase({ regraRecurso: null }))).toEqual([]);
  });
});
