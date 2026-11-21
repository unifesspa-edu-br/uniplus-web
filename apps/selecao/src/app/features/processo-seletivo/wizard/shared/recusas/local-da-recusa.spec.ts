import { describe, expect, it } from 'vitest';

import { localDaRecusa } from './local-da-recusa';

describe('localDaRecusa', () => {
  it('lê o campo da etapa, com a posição dela', () => {
    expect(localDaRecusa('etapas[1].notaMaxima')).toEqual({
      dono: 'etapa',
      indice: 1,
      recurso: null,
      caminho: 'notaMaxima',
    });
  });

  it('escreve os colchetes de um item de lista como pontos', () => {
    expect(localDaRecusa('etapas[0].itensDeAvaliacao[3].pontuacaoMaxima')).toMatchObject({
      caminho: 'itensDeAvaliacao.3.pontuacaoMaxima',
    });
  });

  it('lê o campo da fase, com a posição dela', () => {
    expect(localDaRecusa('fases[2].bancasRequeridas[1].regraDeDeliberacao.quorum')).toEqual({
      dono: 'fase',
      indice: 2,
      recurso: null,
      caminho: 'bancasRequeridas.1.regraDeDeliberacao.quorum',
    });
  });

  it('separa a posição do recurso da etapa do campo dele', () => {
    expect(localDaRecusa('etapas[0].recursos[2].prazoValor')).toEqual({
      dono: 'etapa',
      indice: 0,
      recurso: 2,
      caminho: 'prazoValor',
    });
  });

  it('não trata recursos da fase como recurso da etapa', () => {
    expect(localDaRecusa('fases[0].recursos[1].prazoValor')).toMatchObject({
      recurso: null,
      caminho: 'recursos.1.prazoValor',
    });
  });

  it('aponta o dono inteiro quando o campo não vem depois dele', () => {
    expect(localDaRecusa('etapas[2]')).toMatchObject({ indice: 2, caminho: '' });
  });

  it.each(['$.fases[1].fim', 'request.Fases[1].fim', 'FASES[1].fim'])(
    'ignora o prefixo e a caixa do dono em %s',
    (campo) => {
      expect(localDaRecusa(campo)).toMatchObject({ dono: 'fase', indice: 1, caminho: 'fim' });
    },
  );

  it('reconhece só o dono quando o resto do caminho não se entende', () => {
    expect(localDaRecusa('fases[0].bancas[x].quorum')).toEqual({
      dono: 'fase',
      indice: 0,
      recurso: null,
      caminho: null,
    });
  });

  it.each(['', 'cronograma', 'processo.fases', 'fases[a].fim', 'outrasfases[0]'])(
    'não aponta lugar em "%s"',
    (campo) => {
      expect(localDaRecusa(campo)).toBeNull();
    },
  );
});
