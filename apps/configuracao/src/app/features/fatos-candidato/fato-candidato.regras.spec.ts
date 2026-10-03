import { describe, expect, it } from 'vitest';
import {
  classificacoesDoDominio,
  fatosCitaveisPelaRegra,
  hipotesesDaClassificacao,
  indiceDaRegra,
  podeTerRegras,
  podeTerValores,
} from './fato-candidato.regras';

const fato = (binding: string, extra: Partial<{ sistema: boolean; dominio: string; fonteValores: string | null }> = {}) => ({
  binding,
  sistema: false,
  dominio: 'CATEGORICO',
  fonteValores: 'GLOBAL' as string | null,
  ...extra,
});

describe('o que cada fato deixa manter', () => {
  it('valores: declarado e derivado por regra categóricos de fonte global do administrador', () => {
    expect(podeTerValores(fato('CAMPO_INSCRICAO:COR'))).toBe(true);
    expect(podeTerValores(fato('REGRA_DERIVACAO:PERFIL'))).toBe(true);
    expect(podeTerValores(fato('AGREGACAO_GRUPO:RENDA')), 'o agregado herda os valores do membro').toBe(false);
    expect(podeTerValores(fato('CAMPO_INSCRICAO:COR', { sistema: true })), 'o de sistema só muda por versão').toBe(false);
    expect(podeTerValores(fato('CAMPO_INSCRICAO:OPCAO', { fonteValores: 'PROCESSO' }))).toBe(false);
    expect(podeTerValores(fato('CAMPO_INSCRICAO:IDADE', { dominio: 'NUMERICO', fonteValores: null }))).toBe(false);
  });

  it('regras padrão: só o derivado por regra do administrador', () => {
    expect(podeTerRegras(fato('REGRA_DERIVACAO:PERFIL'))).toBe(true);
    expect(podeTerRegras(fato('AGREGACAO_GRUPO:RENDA')), 'o agregado também é derivado, mas não tem regra').toBe(false);
    expect(podeTerRegras(fato('REGRA_DERIVACAO:MODALIDADE', { sistema: true }))).toBe(false);
  });
});

describe('o que a API recusa e a tela não oferece', () => {
  it('a hipótese legal segue o artigo da classificação', () => {
    const sensivel = hipotesesDaClassificacao('SENSIVEL').map((h) => h.valor);
    const pessoal = hipotesesDaClassificacao('PESSOAL').map((h) => h.valor);
    expect(sensivel).toContain('PREVENCAO_A_FRAUDE');
    expect(sensivel).not.toContain('INTERESSE_LEGITIMO');
    expect(pessoal).toContain('INTERESSE_LEGITIMO');
    expect(pessoal).not.toContain('PREVENCAO_A_FRAUDE');
  });

  it('texto, data e endereço são no mínimo dado pessoal', () => {
    expect(classificacoesDoDominio('TEXTO').map((c) => c.valor)).toEqual(['PESSOAL', 'SENSIVEL']);
    expect(classificacoesDoDominio('BOOLEANO')).toHaveLength(4);
  });

  it('a regra padrão não cita fato desativado, fato de membro nem o próprio derivado', () => {
    const catalogo = [
      { codigo: 'COR', ativo: true, escopo: 'CANDIDATO' },
      { codigo: 'ANTIGO', ativo: false, escopo: 'CANDIDATO' },
      { codigo: 'PARENTESCO', ativo: true, escopo: 'MEMBRO_GRUPO' },
      { codigo: 'PERFIL', ativo: true, escopo: 'CANDIDATO' },
    ];
    expect(fatosCitaveisPelaRegra(catalogo, 'PERFIL').map((f) => f.codigo)).toEqual(['COR']);
  });

  it('a recusa de uma regra aponta o índice dela', () => {
    expect(indiceDaRegra('regras[2].quando[0][1]')).toBe(2);
    expect(indiceDaRegra('regras[0]')).toBe(0);
    expect(indiceDaRegra('nome')).toBeNull();
  });
});
