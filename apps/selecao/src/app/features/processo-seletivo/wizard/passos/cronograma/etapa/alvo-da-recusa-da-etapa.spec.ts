import { describe, expect, it } from 'vitest';

import {
  umaEtapaDoCronograma,
  umRecursoDaEtapa,
} from '../../../shared/etapa-do-cronograma.testing';
import { alvosDaRecusaDaEtapa, type RegrasOferecidas } from './alvo-da-recusa-da-etapa';

const etapa = umaEtapaDoCronograma();
const alvos = (
  campo: string,
  daEtapa: Parameters<typeof alvosDaRecusaDaEtapa>[1],
  indice: number,
  regras: RegrasOferecidas = [],
) => alvosDaRecusaDaEtapa(campo, daEtapa, indice, regras);

describe('alvosDaRecusaDaEtapa', () => {
  it('leva ao bloco do topo a recusa que aponta a etapa inteira', () => {
    expect(alvos('', etapa, 2)).toEqual(['cr-etapa-recusas-2']);
  });

  it('leva ao controle da nota e, de reserva, ao bloco das recusas dele', () => {
    expect(alvos('notaMaxima', etapa, 1)).toEqual([
      'cr-etapa-nota-maxima-1',
      'cr-etapa-nota-maxima-erro-1',
    ]);
    expect(alvos('notaMinima', etapa, 0)).toEqual(['cr-etapa-nota-0', 'cr-etapa-nota-erro-0']);
  });

  it('leva à forma marcada, ou à primeira quando nenhuma está marcada', () => {
    const marcada = umaEtapaDoCronograma({ formaDeAvaliacao: 'HUMANA' });
    expect(alvos('formaDeAvaliacao', marcada, 0)[0]).toBe('cr-etapa-forma-0-HUMANA');
    expect(alvos('formaDeAvaliacao', umaEtapaDoCronograma({ formaDeAvaliacao: '' }), 0)[0]).toMatch(
      /^cr-etapa-forma-0-/,
    );
  });

  it('leva à regra de consolidação marcada, depois à primeira oferecida e por fim ao bloco', () => {
    const marcada = umaEtapaDoCronograma({ regraConsolidacaoCodigo: 'MEDIA' });
    expect(alvos('regraConsolidacao', marcada, 3, ['MEDIA', 'MEDIANA'])).toEqual([
      'cr-etapa-regra-opcao-3-MEDIA',
      'cr-etapa-regra-opcao-3-MEDIA',
      'cr-etapa-regra-erro-3',
    ]);
  });

  it('leva à primeira regra oferecida quando nenhuma está marcada', () => {
    expect(alvos('regraConsolidacao', etapa, 3, ['MEDIA', 'MEDIANA'])).toEqual([
      'cr-etapa-regra-opcao-3-MEDIA',
      'cr-etapa-regra-erro-3',
    ]);
  });

  it('leva só ao bloco da regra quando a tela não oferece regra alguma', () => {
    expect(alvos('regraConsolidacao', etapa, 3)).toEqual(['cr-etapa-regra-erro-3']);
  });

  it('leva ao controle do item pela posição dele, com o bloco do item de reserva', () => {
    expect(alvos('itensDeAvaliacao.2.pontuacaoMaxima', etapa, 1)).toEqual([
      'cr-etapa-1-item-2-pontuacao',
      'cr-etapa-1-item-2-pontuacao-erro',
    ]);
    expect(alvos('escalaDeAtendimento.0.fracao', etapa, 0)[0]).toBe(
      'cr-etapa-0-nivel-0-percentual',
    );
  });

  it('leva ao bloco da lista quando a recusa é da lista inteira', () => {
    expect(alvos('itensDeAvaliacao', etapa, 4)).toEqual(['cr-etapa-4-itens-erro']);
    expect(alvos('escalaDeAtendimento', etapa, 4)).toEqual(['cr-etapa-4-escala-erro']);
  });

  it('leva ao bloco único das bancas', () => {
    expect(alvos('bancas', etapa, 0)).toEqual(['cr-etapa-bancas-erro-0']);
  });

  it.each([
    ['origemDoPrazo', 'cr-rec-anc-2-1'],
    ['ancora', 'cr-rec-ato-2-1'],
  ])('leva o controle %s ao id %s, e de reserva ao bloco das recusas dele', (controle, id) => {
    expect(alvos(`recursos.1.${controle}`, etapa, 2)).toEqual([
      id,
      `cr-rec-recusa-${controle}-2-1`,
    ]);
  });

  it.each([
    ['prazoValor', ['cr-rec-2-1-prazo-interposicao-valor']],
    [
      'prazoUnidade',
      ['cr-rec-2-1-prazo-interposicao-unidade', 'cr-rec-2-1-prazo-interposicao-situacao'],
    ],
    ['efeitoSuspensivo', ['cr-rec-2-1-efeito-grupo']],
    ['guardaDaVaga', ['cr-rec-2-1-guarda-grupo']],
    ['prazoSegundaInstanciaValor', ['cr-rec-2-1-prazo-segunda-valor']],
    [
      'prazoSegundaInstanciaUnidade',
      ['cr-rec-2-1-prazo-segunda-unidade', 'cr-rec-2-1-prazo-segunda-situacao'],
    ],
  ])(
    'leva o parâmetro %s ao controle do componente comum, com o bloco de reserva',
    (controle, ids) => {
      expect(alvos(`recursos.1.${controle}`, etapa, 2)).toEqual([...ids, 'cr-rec-recusas-2-1']);
    },
  );

  it('leva à opção marcada da instância superior do recurso', () => {
    const sem = umaEtapaDoCronograma({
      recursos: [umRecursoDaEtapa({ admiteInstanciaSuperior: false })],
    });
    const com = umaEtapaDoCronograma({
      recursos: [umRecursoDaEtapa({ admiteInstanciaSuperior: true })],
    });
    const reserva = ['cr-rec-0-0-superior-recusas', 'cr-rec-recusas-0-0'];
    expect(alvos('recursos.0.admiteInstanciaSuperior', sem, 0)).toEqual([
      'cr-rec-0-0-superior-nao',
      ...reserva,
    ]);
    expect(alvos('recursos.0.admiteInstanciaSuperior', com, 0)).toEqual([
      'cr-rec-0-0-superior-sim',
      ...reserva,
    ]);
  });

  it('leva ao bloco do recurso quando a recusa é do recurso inteiro', () => {
    expect(alvos('recursos.0.recurso', etapa, 1)).toEqual(['cr-rec-recusa-recurso-1-0']);
  });

  it('cai no bloco do topo da etapa para o campo que a tela não conhece', () => {
    expect(alvos('peso', etapa, 5)).toEqual(['cr-etapa-recusas-5']);
  });
});
