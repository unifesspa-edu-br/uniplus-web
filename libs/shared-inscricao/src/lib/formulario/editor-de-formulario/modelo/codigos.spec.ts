import { CODIGO_CADASTRO_FORMATO } from '@uniplus/shared-utils';

import { codigoDoNome, codigoLivre } from './codigos';

describe('codigoDoNome', () => {
  it('remove acentos e usa letras maiúsculas', () => {
    expect(codigoDoNome('Inscrição pública', 'TERMO')).toBe('INSCRICAO_PUBLICA');
  });

  it('usa a reserva quando há apenas números', () => {
    expect(codigoDoNome('123', 'TERMO')).toBe('TERMO');
  });

  it('remove caracteres iniciais que não são letras', () => {
    expect(codigoDoNome('1_ETAPA', 'TERMO')).toBe('ETAPA');
    expect(codigoDoNome('2ª fase', 'TERMO')).toBe('FASE');
    expect(codigoDoNome('21 de abril', 'TERMO')).toBe('DE_ABRIL');
    expect(codigoDoNome(' ! 1_ÉTAPA', 'TERMO')).toBe('ETAPA');
  });

  it('usa a reserva quando há apenas símbolos', () => {
    expect(codigoDoNome('!@#', 'GRUPO')).toBe('GRUPO');
  });

  it('mantém 60 caracteres e corta o caractere excedente', () => {
    expect(codigoDoNome('A'.repeat(60), 'TERMO')).toBe('A'.repeat(60));
    expect(codigoDoNome('A'.repeat(61), 'TERMO')).toBe('A'.repeat(60));
  });

  it('remove o sublinhado deixado pelo corte em 60 caracteres', () => {
    expect(codigoDoNome(`${'A'.repeat(59)} ${'B'.repeat(10)}`, 'TERMO')).toBe('A'.repeat(59));
  });

  it('substitui uma sequência de separadores por um sublinhado', () => {
    expect(codigoDoNome('nome__do termo', 'TERMO')).toBe('NOME_DO_TERMO');
  });

  it('usa a reserva para nome vazio', () => {
    expect(codigoDoNome('', 'TERMO')).toBe('TERMO');
  });
});

describe('codigoLivre', () => {
  it('mantém a base quando o código está livre', () => {
    expect(codigoLivre('TERMO', 'TERMO', new Set())).toBe('TERMO');
  });

  it('limita a base livre a 60 caracteres', () => {
    expect(codigoLivre('A'.repeat(61), 'TERMO', new Set())).toBe('A'.repeat(60));
  });

  it('remove sublinhados finais antes de verificar se a base está livre', () => {
    expect(codigoLivre('TERMO_', 'TERMO', new Set(['TERMO']))).toBe('TERMO_2');
  });

  it('corta a base e remove o sublinhado antes de acrescentar o sufixo livre', () => {
    const base = `${'A'.repeat(57)}_BC`;
    const segundo = `${'A'.repeat(57)}_2`;
    expect(codigoLivre(base, 'TERMO', new Set([base, segundo]))).toBe(`${'A'.repeat(57)}_3`);
  });

  it('remove dígitos iniciais antes de procurar um código livre', () => {
    expect(codigoLivre('1_ETAPA', 'TERMO', new Set(['ETAPA']))).toBe('ETAPA_2');
  });

  it('usa a reserva quando o nome contém apenas números', () => {
    expect(codigoLivre('123', 'TERMO', new Set())).toBe('TERMO');
  });

  it('gera códigos válidos para nomes e colisões nas bordas', () => {
    const nomes = ['Inscrição pública', '!@#', '1_ETAPA', 'A'.repeat(60), 'A'.repeat(61)];
    for (const nome of nomes) {
      const codigo = codigoDoNome(nome, 'GRUPO');
      const livre = codigoLivre(nome, 'GRUPO', new Set([codigo, `${codigo.slice(0, 58)}_2`]));
      expect(codigo).toMatch(CODIGO_CADASTRO_FORMATO);
      expect(livre).toMatch(CODIGO_CADASTRO_FORMATO);
      expect(livre.length).toBeLessThanOrEqual(60);
    }
  });
});
