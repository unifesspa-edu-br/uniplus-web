import { EtapaDaVersaoCodigo } from '@uniplus/shared-data/autorizacao';
import { describe, expect, it } from 'vitest';
import { etapaDaVersao } from './enums-da-api.testing';
import { decisaoDaEtapa, porQuemDecide } from './rotulos-da-versao';

const PROTECAO = etapaDaVersao(EtapaDaVersaoCodigo.PROTECAO_DE_DADOS);
const GESTAO = etapaDaVersao(EtapaDaVersaoCodigo.GESTAO_DE_ACESSOS);

describe('rótulos da versão', () => {
  it('nomeia o Representante do controlador como quem decide a etapa de proteção de dados', () => {
    expect(decisaoDaEtapa(PROTECAO)).toBe('decisão do Representante do controlador');
    expect(porQuemDecide(PROTECAO)).toBe('pelo Representante do controlador');
  });

  it('nomeia a gestão de acessos como quem decide a etapa funcional', () => {
    expect(decisaoDaEtapa(GESTAO)).toBe('decisão da gestão de acessos');
    expect(porQuemDecide(GESTAO)).toBe('pela gestão de acessos');
  });

  it('a etapa que a tela não conhece aparece pelo rótulo da API, sem atribuir a decisão a um papel', () => {
    const nova = { codigo: 'NOVA_ETAPA', rotulo: 'Etapa nova' };

    expect(decisaoDaEtapa(nova)).toBe('decisão da etapa Etapa nova');
    expect(porQuemDecide(nova)).toBe('pela etapa Etapa nova');
  });
});
