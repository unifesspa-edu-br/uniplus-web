import { describe, expect, it } from 'vitest';
import type { BancaDeclarada } from '../../modelos/banca.models';
import type { LocalDaRecusa } from '../recusas/local-da-recusa';
import {
  bancaDoCampo,
  campoDaBancaEnviada,
  campoDaBancaIdentificada,
  campoDaBancaReconhecida,
  localDaBancaEnviada,
  localDaBancaIdentificada,
} from './campo-da-banca';

const bancas: readonly BancaDeclarada[] = [
  {
    id: '1',
    identificadorLocal: 'local-1',
    tipoBancaId: 'tipo',
    regraDeDeliberacao: null,
    copiaDoTipo: null,
  },
  {
    id: '2',
    identificadorLocal: 'local-2',
    tipoBancaId: 'tipo',
    regraDeDeliberacao: null,
    copiaDoTipo: null,
  },
];

describe('campo da banca', () => {
  it('usa a posição enviada mesmo para bancas do mesmo tipo', () => {
    expect(
      campoDaBancaEnviada(
        'bancasRequeridas.0.regraDeDeliberacao.quorum',
        'bancasRequeridas',
        bancas,
      ),
    ).toBe('bancasRequeridas.local-1.regraDeDeliberacao.quorum');
    expect(campoDaBancaEnviada('bancasRequeridas.1', 'bancasRequeridas', bancas)).toBe(
      'bancasRequeridas.local-2',
    );
  });

  it('usa o identificador da publicação em vez da posição', () => {
    expect(
      campoDaBancaIdentificada('bancas.0.regraDeDeliberacao.modo', 'bancas', bancas, '2'),
    ).toBe('bancas.local-2.regraDeDeliberacao.modo');
  });

  it('aponta a seção quando a banca não existe ou não tem identificador', () => {
    expect(campoDaBancaEnviada('bancas.3', 'bancas', bancas)).toBe('bancas');
    expect(campoDaBancaIdentificada('bancas.0', 'bancas', bancas, null)).toBe('bancas');
    expect(campoDaBancaIdentificada('bancas.0', 'bancas', bancas.slice(1), '1')).toBe('bancas');
  });

  it('não converte um campo de outra lista', () => {
    expect(campoDaBancaEnviada('recursos.0', 'bancas', bancas)).toBeNull();
  });
});

const daEtapa = (caminho: string | null): LocalDaRecusa => ({
  dono: 'etapa',
  indice: 0,
  recurso: null,
  caminho,
});

describe('local da recusa com a banca da tela', () => {
  it('troca a posição enviada pelo identificador da banca na tela', () => {
    const { local, bancaAusente } = localDaBancaEnviada(
      daEtapa('bancas.1.regraDeDeliberacao.quorum'),
      'bancas',
      bancas,
    );

    expect(local.caminho).toBe('bancas.local-2.regraDeDeliberacao.quorum');
    expect(bancaAusente).toBe(false);
  });

  it('marca a banca ausente quando a posição enviada não existe, e deixa a recusa na seção', () => {
    const { local, bancaAusente } = localDaBancaEnviada(daEtapa('bancas.5'), 'bancas', bancas);

    expect(local.caminho).toBe('bancas');
    expect(bancaAusente).toBe(true);
  });

  it('não marca como ausente a recusa que nunca apontou banca', () => {
    const semPosicao = localDaBancaEnviada(daEtapa('bancas'), 'bancas', bancas);
    const semCaminho = localDaBancaEnviada(daEtapa(null), 'bancas', bancas);

    expect(semPosicao).toEqual({ local: daEtapa('bancas'), bancaAusente: false });
    expect(semCaminho).toEqual({ local: daEtapa(null), bancaAusente: false });
  });

  it('acha pelo identificador da publicação a banca que mudou de posição', () => {
    const { local, bancaAusente } = localDaBancaIdentificada(
      daEtapa('bancas.0'),
      'bancas',
      bancas,
      '2',
    );

    expect(local.caminho).toBe('bancas.local-2');
    expect(bancaAusente).toBe(false);
  });

  it('marca a banca ausente quando o identificador não está na tela ou não veio', () => {
    expect(localDaBancaIdentificada(daEtapa('bancas.0'), 'bancas', bancas, 'x').bancaAusente).toBe(
      true,
    );
    expect(localDaBancaIdentificada(daEtapa('bancas.0'), 'bancas', bancas, null).bancaAusente).toBe(
      true,
    );
  });
});

describe('campo sob o identificador da banca', () => {
  it('lê o identificador e o controle do campo da banca', () => {
    expect(bancaDoCampo('bancas.local-2.quorum', 'bancas')).toEqual({
      identificador: 'local-2',
      controle: 'quorum',
    });
    expect(bancaDoCampo('bancas.local-2', 'bancas')).toEqual({
      identificador: 'local-2',
      controle: null,
    });
  });

  it('não lê como banca a seção nem o campo de outra lista', () => {
    expect(bancaDoCampo('bancas', 'bancas')).toBeNull();
    expect(bancaDoCampo('bancasRequeridas.local-2', 'bancas')).toBeNull();
  });

  it.each([
    [['local-1'], 'bancasRequeridas.local-1'],
    [['local-1', 'id'], 'bancasRequeridas.local-1'],
    [['local-1', 'regraDeDeliberacao', 'quorum'], 'bancasRequeridas.local-1.quorum'],
    [['local-1', 'regraDeDeliberacao', 'encerramento'], 'bancasRequeridas.local-1.encerramento'],
    [['local-1', 'regraDeDeliberacao'], 'bancasRequeridas.local-1.regra'],
    [['local-1', 'regraDeDeliberacao', 'inventado'], 'bancasRequeridas.local-1.regra'],
    [['local-1', 'categoriasDocumentoIds', '0'], 'bancasRequeridas.local-1.categoriasDocumentoIds'],
    [[], 'bancasRequeridas'],
    [['3'], 'bancasRequeridas'],
  ])('reconhece o campo %j como %s', (partes, esperado) => {
    expect(campoDaBancaReconhecida('bancasRequeridas', partes)).toBe(esperado);
  });
});
