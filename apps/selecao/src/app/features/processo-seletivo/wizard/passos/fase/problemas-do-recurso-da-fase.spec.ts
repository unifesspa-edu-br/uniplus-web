import { UnidadePrazo } from '@uniplus/shared-data/selecao';
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

  it('recusa prazo de interposição em dias corridos', () => {
    const problemas = conferir(comPreliminar({ prazoUnidade: UnidadePrazo.dias }));

    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.prazo');
    expect(problemas[0].mensagem).toContain('dias corridos não é aceito');
  });

  it('recusa fração de dia útil no prazo de interposição', () => {
    const problemas = conferir(comPreliminar({ prazoValor: '1,5' }));

    expect(problemas[0].mensagem).toContain('dias úteis exige valor inteiro');
  });

  it('recusa prazo não positivo', () => {
    const problemas = conferir(comPreliminar({ prazoValor: '0' }));

    expect(problemas[0].mensagem).toContain('maior que zero');
  });

  it('cobra a unidade do prazo', () => {
    const problemas = conferir(comPreliminar({ prazoUnidade: '' }));

    expect(problemas.map((problema) => problema.mensagem)).toContain(
      'Declare a unidade do prazo de interposição: dias úteis ou horas.',
    );
  });

  it('cobra a regra de contagem escolhida no catálogo', () => {
    const problemas = conferir(comPreliminar({ regraCodigo: '' }));

    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.regra');
  });

  it('recusa suspensividade com metade do par preenchida', () => {
    const problemas = conferir(comPreliminar({ suspensividadePrimeiraInstanciaValor: '3' }));

    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.suspensividadePrimeiraInstancia');
    expect(problemas[0].mensagem).toContain('valor e unidade juntos');
  });

  it('aceita o par de suspensividade inteiro em branco como desativação', () => {
    expect(conferir(comPreliminar())).toEqual([]);
  });

  it('cobra a resposta sobre a instância superior, que não tem valor padrão', () => {
    const problemas = conferir(comPreliminar({ admiteInstanciaSuperior: null }));

    expect(problemas).toHaveLength(1);
    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.admiteInstanciaSuperior');
  });

  it('não confere o tempo de bloqueio da instância superior que a janela não admite', () => {
    const semInstancia = comPreliminar({
      admiteInstanciaSuperior: false,
      suspensividadeSegundaInstanciaValor: '48',
    });

    expect(conferir(semInstancia)).toEqual([]);
  });

  it('confere o tempo de bloqueio da instância superior que a janela admite', () => {
    const problemas = conferir(
      comPreliminar({ admiteInstanciaSuperior: true, suspensividadeSegundaInstanciaValor: '48' }),
    );

    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.suspensividadeSegundaInstancia');
  });

  /**
   * A âncora é escolhida entre os preliminares da própria fase. Sem nenhum, o
   * problema é a publicação que falta — não a escolha.
   */
  it('aponta a publicação preliminar que falta quando a fase admite recurso sem ter uma', () => {
    const problemas = conferir(
      fase({
        produtos: [{ atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' }],
        regraRecurso: recurso({ atoAncoraCodigo: '' }),
      }),
    );

    expect(problemas.map((problema) => problema.campo)).toContain<CampoDaFase>('produtos');
  });

  it('cobra a escolha da âncora quando a fase publica dois preliminares', () => {
    const problemas = conferir(
      fase({
        produtos: [
          { atoCodigo: 'GABARITO_PRELIMINAR', papel: 'PRELIMINAR' },
          { atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' },
          { atoCodigo: 'RESULTADO_FINAL', papel: 'DEFINITIVO' },
        ],
        regraRecurso: recurso({ atoAncoraCodigo: '' }),
      }),
    );

    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.ancora');
    expect(problemas[0].mensagem).toContain('Escolha a publicação preliminar');
  });

  it('recusa a âncora que a fase não publica como preliminar', () => {
    const problemas = conferir(comPreliminar({ atoAncoraCodigo: 'RESULTADO_FINAL' }));

    expect(problemas[0].campo).toBe<CampoDaFase>('recurso.ancora');
    expect(problemas[0].mensagem).toContain('publicado por esta própria fase');
  });
});
