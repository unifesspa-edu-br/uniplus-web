import { describe, expect, it } from 'vitest';

import { formatoDaChaveValido, novaChave } from './chave-local';

function chaveDe(tipo: string, nome: string, tomadas: readonly string[] = []): string {
  return novaChave({ tipo, nome, tomadas: new Set(tomadas) });
}

const RotuloLongo = 'Domínio da modalidade escrita formal da língua portuguesa e adequação ao tema';

describe('novaChave: tabela de exemplos da regra', () => {
  it.each<[string, string, string, readonly string[], string]>([
    ['fase', 'fase', 'INSCRICAO', [], 'fase_inscricao'],
    ['etapa', 'etapa', 'PROVA_OBJETIVA', [], 'etapa_prova_objetiva'],
    [
      'segunda etapa do tipo',
      'etapa',
      'PROVA_OBJETIVA',
      ['etapa_prova_objetiva'],
      'etapa_prova_objetiva_2',
    ],
    [
      'banca cujo código começa por banca_',
      'banca',
      'BANCA_HETEROIDENTIFICACAO',
      [],
      'banca_heteroidentificacao',
    ],
    ['banca cujo código é o prefixo', 'banca', 'BANCA', [], 'banca'],
    ['banca que só começa pelas mesmas letras', 'banca', 'BANCARIA', [], 'banca_bancaria'],
    ['exigência', 'exigencia', 'CERTIDAO_NASCIMENTO', [], 'exigencia_certidao_nascimento'],
    [
      'segunda exigência de código com dígito',
      'exigencia',
      'FOTO_3X4',
      ['exigencia_foto_3x4'],
      'exigencia_foto_3x4_2',
    ],
    [
      'código cuja chave formada já existe',
      'exigencia',
      'FOTO_3X4_2',
      ['exigencia_foto_3x4', 'exigencia_foto_3x4_2'],
      'exigencia_foto_3x4_2_2',
    ],
    ['item com acento', 'item', 'Redação', [], 'item_redacao'],
    ['item repetido na etapa', 'item', 'Redação', ['item_redacao'], 'item_redacao_2'],
    [
      'nível com pontuação',
      'nivel',
      'Atende parcialmente (50%)',
      [],
      'nivel_atende_parcialmente_50',
    ],
    ['rótulo só de pontuação', 'item', '—', [], 'item'],
    ['nível vazio repetido', 'nivel', '(*)', ['nivel'], 'nivel_2'],
  ])('%s', (...linha) => {
    const [, prefixo, texto, tomadas, esperada] = linha;
    expect(chaveDe(prefixo, texto, tomadas)).toBe(esperada);
  });

  it('corta o rótulo longo na última palavra inteira que cabe em 64 caracteres', () => {
    const chave = chaveDe('item', RotuloLongo);

    expect(chave).toBe('item_dominio_da_modalidade_escrita_formal_da_lingua_portuguesa_e');
    expect(chave).toHaveLength(64);
  });

  it('conta o sufixo no corte do rótulo longo', () => {
    const primeira = chaveDe('item', RotuloLongo);
    const segunda = chaveDe('item', RotuloLongo, [primeira]);

    expect(segunda).toBe('item_dominio_da_modalidade_escrita_formal_da_lingua_portuguesa_2');
    expect(segunda).toHaveLength(64);
  });
});

describe('novaChave: o conjunto de chaves tomadas', () => {
  it('não reaproveita a chave de parte excluída que uma referência ainda cita', () => {
    expect(chaveDe('etapa', 'PROVA_OBJETIVA', ['etapa_prova_objetiva'])).toBe(
      'etapa_prova_objetiva_2',
    );
  });

  it('usa o menor sufixo livre', () => {
    const tomadas = ['item_prova', 'item_prova_2', 'item_prova_4'];

    expect(chaveDe('item', 'Prova', tomadas)).toBe('item_prova_3');
  });

  it('mantém a chave sem sufixo quando só uma chave parecida está tomada', () => {
    expect(chaveDe('item', 'Prova', ['item_prova_escrita'])).toBe('item_prova');
  });

  it('numera o texto vazio repetido a partir de 2, sem repetir', () => {
    expect(chaveDe('nivel', '', ['nivel', 'nivel_2'])).toBe('nivel_3');
  });
});

describe('novaChave: limite de 64 caracteres', () => {
  it('mantém 64 caracteres exatos', () => {
    const texto = 'a'.repeat(59);

    expect(chaveDe('item', texto)).toBe(`item_${texto}`);
  });

  it('cabe em 64 caracteres também com sufixo de dois dígitos', () => {
    const tomadas: string[] = [];
    for (let numero = 1; numero <= 10; numero++)
      tomadas.push(chaveDe('item', RotuloLongo, tomadas));
    const decima = tomadas[9];

    expect(decima.endsWith('_10')).toBe(true);
    expect(decima.length).toBeLessThanOrEqual(64);
    expect(formatoDaChaveValido(decima)).toBe(true);
  });

  it('fica só no prefixo quando o texto é uma palavra única maior que o limite', () => {
    expect(chaveDe('item', 'x'.repeat(80))).toBe('item');
  });

  it('gera chave válida e livre para vários textos, também em colisão repetida', () => {
    const textos = ['', '!!!', '2ª chamada', 'x'.repeat(70), 'Prova escrita', RotuloLongo];
    for (const texto of textos) {
      const tomadas = new Set<string>();
      for (let rodada = 0; rodada < 12; rodada++) {
        const chave = novaChave({ tipo: 'item', nome: texto, tomadas });

        expect(formatoDaChaveValido(chave), chave).toBe(true);
        expect(tomadas.has(chave)).toBe(false);
        tomadas.add(chave);
      }
    }
  });
});

describe('formatoDaChaveValido', () => {
  it.each(['a', 'etapa_1', 'etapa_prova_objetiva_2', 'a1_b2', 'a'.repeat(64)])(
    'aceita %s',
    (chave) => {
      expect(formatoDaChaveValido(chave)).toBe(true);
    },
  );

  it.each([
    ['maiúscula', 'Etapa'],
    ['hífen', 'prova-objetiva'],
    ['sublinhado duplo', 'etapa__1'],
    ['sublinhado no fim', 'etapa_'],
    ['sublinhado no início', '_etapa'],
    ['começa por dígito', '1etapa'],
    ['vazia', ''],
    ['acento', 'avaliação'],
    ['65 caracteres', 'a'.repeat(65)],
  ])('recusa chave com %s', (_motivo, chave) => {
    expect(formatoDaChaveValido(chave)).toBe(false);
  });
});
