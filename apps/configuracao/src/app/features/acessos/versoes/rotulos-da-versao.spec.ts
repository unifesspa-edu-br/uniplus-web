import { describe, expect, it } from 'vitest';
import { decisaoDaEtapa, etapaDaVersao, porQuemDecide } from './rotulos-da-versao';

describe('rótulos da versão', () => {
  it('mantém o nome da etapa pelo que ela confere', () => {
    expect(etapaDaVersao('protecao_de_dados')).toBe('Proteção de dados');
    expect(etapaDaVersao('gestao_de_acessos')).toBe('Gestão de acessos');
  });

  it('nomeia o Representante do controlador como quem decide a etapa de proteção de dados', () => {
    expect(decisaoDaEtapa('protecao_de_dados')).toBe('decisão do Representante do controlador');
    expect(porQuemDecide('protecao_de_dados')).toBe('pelo Representante do controlador');
  });

  it('nomeia a gestão de acessos como quem decide a etapa funcional', () => {
    expect(decisaoDaEtapa('gestao_de_acessos')).toBe('decisão da gestão de acessos');
    expect(porQuemDecide('gestao_de_acessos')).toBe('pela gestão de acessos');
  });

  it('a etapa que a tela não conhece aparece pelo código, sem atribuir a decisão a um papel', () => {
    expect(decisaoDaEtapa('nova_etapa')).toBe('decisão da etapa nova_etapa');
    expect(porQuemDecide('nova_etapa')).toBe('pela etapa nova_etapa');
  });
});
