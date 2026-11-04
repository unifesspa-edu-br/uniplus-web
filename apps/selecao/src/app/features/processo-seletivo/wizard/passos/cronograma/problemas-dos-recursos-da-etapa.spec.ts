import { describe, expect, it } from 'vitest';
import { UnidadePrazo } from '@uniplus/shared-data/selecao';
import { type RecursoDaEtapa } from '../../processo-seletivo.models';
import { problemasDoCronograma } from './cronograma-do-certame';
import {
  SEM_CATALOGO,
  nomeDaBanca,
  tipoQueAdmiteTudo,
  etapa,
  PRELIMINAR,
  catalogoDeFases,
  faseDeAvaliacao,
} from './cronograma-do-certame.testing';

describe('janela de recurso da etapa', () => {
  function comRecurso(patch: Partial<RecursoDaEtapa>): readonly string[] {
    return problemasDoCronograma(
      [faseDeAvaliacao],
      [
        etapa({
          nome: 'Prova Objetiva',
          faseCodigo: 'AVALIACAO',
          recursos: [
            {
              ancora: 'atoPublicado',
              regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
              regraVersao: '1.0.0',
              prazoValor: '2',
              prazoUnidade: 'diasUteis',
              atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
              suspensividadePrimeiraInstanciaValor: '',
              suspensividadePrimeiraInstanciaUnidade: '',
              admiteInstanciaSuperior: true,
              suspensividadeSegundaInstanciaValor: '',
              suspensividadeSegundaInstanciaUnidade: '',
              ...patch,
            },
          ],
        }),
      ],
      catalogoDeFases,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [],
    );
  }

  /**
   * A janela ancorada em ato corre da publicação preliminar DA PRÓPRIA etapa, e os produtos
   * mudam por outro caminho: retirar o preliminar deixava a janela apontando para o que não
   * existe mais. A gravação seguia, e o servidor recusava a etapa inteira sem dizer que o
   * problema era a âncora — nem em qual etapa.
   */
  it('acusa a janela que corre de uma publicação que a etapa não declara mais', () => {
    expect(comRecurso({})).toContainEqual(
      expect.stringContaining('resultado preliminar que a etapa não declara mais'),
    );
  });

  it('não acusa quando a etapa declara a publicação de que a janela corre', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [
        etapa({
          nome: 'Prova Objetiva',
          faseCodigo: 'AVALIACAO',
          produtos: [PRELIMINAR],
          recursos: [
            {
              ancora: 'atoPublicado',
              regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
              regraVersao: '1.0.0',
              prazoValor: '2',
              prazoUnidade: 'diasUteis',
              atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
              suspensividadePrimeiraInstanciaValor: '',
              suspensividadePrimeiraInstanciaUnidade: '',
              admiteInstanciaSuperior: true,
              suspensividadeSegundaInstanciaValor: '',
              suspensividadeSegundaInstanciaUnidade: '',
            },
          ],
        }),
      ],
      catalogoDeFases,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [],
    );

    expect(problemas).not.toContainEqual(
      expect.stringContaining('resultado preliminar que a etapa não declara mais'),
    );
  });

  it('acusa prazo em branco', () => {
    expect(comRecurso({ prazoValor: '' })).toContainEqual(
      expect.stringContaining('prazo maior que zero'),
    );
  });

  it('acusa prazo que a gramática numérica não aceita', () => {
    expect(comRecurso({ prazoValor: '2,5 dias' })).toContainEqual(
      expect.stringContaining('prazo maior que zero'),
    );
  });

  it('acusa prazo zero declarado', () => {
    expect(comRecurso({ prazoValor: '0' })).toContainEqual(
      expect.stringContaining('prazo maior que zero'),
    );
  });

  it('não acusa prazo válido', () => {
    expect(comRecurso({})).not.toContainEqual(expect.stringContaining('prazo maior que zero'));
  });

  /**
   * As duas conferências que só a fase tinha. O prazo e a suspensividade vivem no MESMO value
   * object nos dois donos, e o servidor as prova nos dois — a tela que aprovasse
   * aqui mandaria o operador colher um 422 que a fase nunca deixaria acontecer.
   */
  it('acusa fração de dia útil no prazo', () => {
    expect(comRecurso({ prazoValor: '2.5', prazoUnidade: 'diasUteis' })).toContainEqual(
      expect.stringContaining('fração de dia útil'),
    );
  });

  it('não acusa dia útil inteiro', () => {
    expect(comRecurso({ prazoValor: '2', prazoUnidade: 'diasUteis' })).not.toContainEqual(
      expect.stringContaining('fração de dia útil'),
    );
  });

  it('acusa suspensividade com valor e sem unidade', () => {
    expect(comRecurso({ suspensividadePrimeiraInstanciaValor: '3' })).toContainEqual(
      expect.stringContaining('suspensividade'),
    );
  });

  it('cobra a resposta sobre a instância superior da janela', () => {
    expect(comRecurso({ admiteInstanciaSuperior: null })).toContainEqual(
      expect.stringContaining('instância superior'),
    );
  });

  it('não confere o tempo de bloqueio superior da janela que não admite a instância', () => {
    expect(
      comRecurso({
        admiteInstanciaSuperior: false,
        suspensividadeSegundaInstanciaUnidade: UnidadePrazo.horas,
      }),
    ).not.toContainEqual(expect.stringContaining('suspensividade'));
  });

  it('acusa suspensividade com unidade e sem valor', () => {
    expect(
      comRecurso({ suspensividadeSegundaInstanciaUnidade: UnidadePrazo.horas }),
    ).toContainEqual(expect.stringContaining('suspensividade'));
  });

  it('acusa suspensividade não positiva', () => {
    expect(
      comRecurso({
        suspensividadePrimeiraInstanciaValor: '0',
        suspensividadePrimeiraInstanciaUnidade: UnidadePrazo.diasUteis,
      }),
    ).toContainEqual(expect.stringContaining('suspensividade'));
  });

  it('aceita o par completo, e aceita a instância desativada', () => {
    const comPar = comRecurso({
      suspensividadePrimeiraInstanciaValor: '3',
      suspensividadePrimeiraInstanciaUnidade: UnidadePrazo.diasUteis,
    });
    expect(comPar).not.toContainEqual(expect.stringContaining('suspensividade'));
    expect(comRecurso({})).not.toContainEqual(expect.stringContaining('suspensividade'));
  });

  /** Janela sem regra resolvida é descartada na gravação — e isso precisa ser dito. */
  it('acusa a janela cuja regra o catálogo ainda não resolveu', () => {
    expect(comRecurso({ regraCodigo: '', regraVersao: '' })).toContainEqual(
      expect.stringContaining('sem a regra de prazo'),
    );
  });
});
