import { describe, expect, it } from 'vitest';

import type { RecursoDaEtapa } from '../../processo-seletivo.models';
import {
  PARAMETROS_COM_INSTANCIA_SUPERIOR,
  umaLeituraDoRecurso,
} from '../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
import { problemasDoCronograma } from './cronograma-do-certame';
import {
  etapa,
  PRELIMINAR,
  faseDeAvaliacao,
  catalogosDeTeste,
} from './cronograma-do-certame.testing';

const RECURSO: RecursoDaEtapa = {
  ancora: 'atoPublicado',
  regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
  regraVersao: '1.0.0',
  ...PARAMETROS_COM_INSTANCIA_SUPERIOR,
  atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
  leitura: umaLeituraDoRecurso(),
  procedimentos: [],
};

describe('recurso da etapa', () => {
  function comRecurso(
    patch: Partial<RecursoDaEtapa>,
    produtos: readonly (typeof PRELIMINAR)[] = [],
  ): readonly string[] {
    return problemasDoCronograma({
      fases: [faseDeAvaliacao],
      etapas: [
        etapa({
          nome: 'Prova Objetiva',
          faseCodigo: 'AVALIACAO',
          produtos: [...produtos],
          recursos: [{ ...RECURSO, ...patch }],
        }),
      ],
      exigencias: [],
      catalogos: catalogosDeTeste(),
    });
  }

  /**
   * O recurso ancorado em ato corre da publicação preliminar DA PRÓPRIA etapa, e os produtos
   * mudam por outro caminho: retirar o preliminar deixava o recurso apontando para o que não
   * existe mais. A gravação seguia, e o servidor recusava a etapa inteira sem dizer que o
   * problema era a âncora, nem em qual etapa.
   */
  it('acusa o recurso que corre de uma publicação que a etapa não declara mais', () => {
    expect(comRecurso({})).toContainEqual(
      expect.stringContaining('resultado preliminar que a etapa não declara mais'),
    );
  });

  it('não acusa quando a etapa declara a publicação de que o recurso corre', () => {
    expect(comRecurso({}, [PRELIMINAR])).not.toContainEqual(
      expect.stringContaining('resultado preliminar que a etapa não declara mais'),
    );
  });

  it('acusa a instância superior sem resposta, nomeando a etapa', () => {
    expect(comRecurso({ admiteInstanciaSuperior: null }, [PRELIMINAR])).toContainEqual(
      'Responda, no recurso da etapa "Prova Objetiva", se ele admite instância superior.',
    );
  });

  it('não acusa a instância superior respondida, seja qual for a resposta', () => {
    for (const admite of [true, false]) {
      expect(comRecurso({ admiteInstanciaSuperior: admite }, [PRELIMINAR])).toEqual([]);
    }
  });

  /**
   * O web não confere prazo, efeito suspensivo nem guarda da vaga: o valor lido é preservado e
   * enviado, e quem recusa é a API.
   */
  it.each([
    ['prazo em branco', { prazoValor: '' }],
    ['prazo zero', { prazoValor: '0' }],
    ['prazo fracionário em dias úteis', { prazoValor: '2,5' }],
    ['unidade em branco', { prazoUnidade: '' as const }],
    ['efeito suspensivo em branco', { efeitoSuspensivo: '' as const }],
    ['guarda da vaga em branco', { guardaDaVaga: '' as const }],
    ['prazo da 2ª instância incompleto', { prazoSegundaInstanciaValor: '' }],
  ])('não confere localmente: %s', (_nome, patch) => {
    expect(comRecurso(patch, [PRELIMINAR])).toEqual([]);
  });

  /** Recurso sem regra resolvida é descartado na gravação, e isso precisa ser dito. */
  it('acusa o recurso cuja regra o catálogo ainda não resolveu', () => {
    expect(comRecurso({ regraCodigo: '', regraVersao: '' }, [PRELIMINAR])).toContainEqual(
      expect.stringContaining('sem a regra de prazo'),
    );
  });
});
