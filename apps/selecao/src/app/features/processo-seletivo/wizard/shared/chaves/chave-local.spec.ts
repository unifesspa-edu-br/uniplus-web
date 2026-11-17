import { describe, expect, it } from 'vitest';

import { formatoDaChaveValido, novaChave } from './chave-local';

function chaveDe(nome: string, tomadas: readonly string[] = [], tipo = 'etapa'): string {
  return novaChave({ tipo, nome, tomadas: new Set(tomadas) });
}

describe('novaChave a partir do nome', () => {
  it('tira acento e cedilha', () => {
    expect(chaveDe('Avaliação Pós-Graduação')).toBe('avaliacao-pos-graduacao');
  });

  it('troca espaços e pontuação por um único hífen, sem hífen nas pontas', () => {
    expect(chaveDe('  Prova -- escrita (1ª fase)!  ')).toBe('prova-escrita-1-fase');
  });

  it('usa o tipo como prefixo quando o nome começa por número', () => {
    expect(chaveDe('2ª chamada', [], 'fase')).toBe('fase-2-chamada');
  });

  it('mantém 64 caracteres exatos', () => {
    expect(chaveDe('a'.repeat(64))).toBe('a'.repeat(64));
  });

  it('trunca em 64 sem terminar em hífen', () => {
    expect(chaveDe(`${'a'.repeat(63)} b`)).toBe('a'.repeat(63));
  });

  it('gera sempre uma chave de formato válido', () => {
    expect(formatoDaChaveValido(chaveDe('Ünïcôdé — Ação / 3'))).toBe(true);
  });
});

describe('novaChave sem nome aproveitável', () => {
  it.each(['', '   ', '!!! ???', '— / ©'])('usa tipo-1 para %j', (nome) => {
    expect(chaveDe(nome, [], 'banca')).toBe('banca-1');
  });

  it('usa o menor número livre quando tipo-1 está tomado', () => {
    expect(chaveDe('', ['etapa-1'])).toBe('etapa-2');
    expect(chaveDe('', ['etapa-1', 'etapa-3'])).toBe('etapa-2');
    expect(chaveDe('', ['etapa-1', 'etapa-2'])).toBe('etapa-3');
  });
});

describe('novaChave em colisão', () => {
  it('acrescenta -2 quando outra parte do mesmo tipo já usa a chave', () => {
    expect(chaveDe('Prova escrita', ['prova-escrita'])).toBe('prova-escrita-2');
  });

  it('acrescenta o menor sufixo livre', () => {
    expect(chaveDe('Prova', ['prova', 'prova-2', 'prova-4'])).toBe('prova-3');
  });

  it('não reaproveita a chave de parte excluída que ainda é citada', () => {
    const citadas = ['analise-documental'];
    expect(chaveDe('Análise documental', citadas)).toBe('analise-documental-2');
  });

  it('mantém a chave sem sufixo quando só uma chave parecida está tomada', () => {
    expect(chaveDe('Prova', ['prova-escrita'])).toBe('prova');
  });

  it('preserva espaço para o sufixo perto do limite de 64', () => {
    const base = 'a'.repeat(64);
    const chave = chaveDe(base, [base]);

    expect(chave).toBe(`${'a'.repeat(62)}-2`);
    expect(chave).toHaveLength(64);
    expect(formatoDaChaveValido(chave)).toBe(true);
  });

  it('cabe em 64 com sufixo de dois dígitos', () => {
    const base = 'a'.repeat(64);
    const tomadas = [base, ...Array.from({ length: 8 }, (_, i) => `${'a'.repeat(62)}-${i + 2}`)];
    const chave = chaveDe(base, tomadas);

    expect(chave).toBe(`${'a'.repeat(61)}-10`);
    expect(chave).toHaveLength(64);
  });

  it('não deixa hífen antes do sufixo quando o corte cai num hífen', () => {
    const nome = `${'a'.repeat(61)} b`;
    expect(chaveDe(nome, [`${'a'.repeat(61)}-b`])).toBe(`${'a'.repeat(61)}-2`);
  });
});

describe('novaChave com tipo longo', () => {
  const tipoLongo = 'a'.repeat(64);

  it('mantém até 64 caracteres sem nome, truncando o tipo para caber o número', () => {
    const chave = chaveDe('', [], tipoLongo);

    expect(chave).toBe(`${'a'.repeat(32)}-1`);
    expect(formatoDaChaveValido(chave)).toBe(true);
  });

  it('gera chaves válidas e distintas de tipo-1 a tipo-10', () => {
    const tomadas: string[] = [];
    for (let numero = 1; numero <= 10; numero++) {
      const chave = chaveDe('', tomadas, tipoLongo);

      expect(chave.endsWith(`-${numero}`)).toBe(true);
      expect(formatoDaChaveValido(chave)).toBe(true);
      expect(tomadas).not.toContain(chave);
      tomadas.push(chave);
    }
  });

  it('não termina o prefixo em hífen ao truncar o tipo', () => {
    const tipo = `${'a'.repeat(31)}-${'b'.repeat(32)}`;

    expect(chaveDe('', [], tipo)).toBe(`${'a'.repeat(31)}-1`);
  });

  it('junta o prefixo truncado ao nome que começa por dígito, até 64 caracteres', () => {
    const chave = chaveDe(`2${'x'.repeat(80)}`, [], tipoLongo);

    expect(chave).toBe(`${'a'.repeat(32)}-2${'x'.repeat(30)}`);
    expect(chave).toHaveLength(64);
    expect(formatoDaChaveValido(chave)).toBe(true);
  });

  it('acrescenta o sufixo de colisão ao prefixo mais o nome sem passar de 64', () => {
    const nome = `2${'x'.repeat(80)}`;
    const primeira = chaveDe(nome, [], tipoLongo);
    const segunda = chaveDe(nome, [primeira], tipoLongo);

    expect(segunda).toHaveLength(64);
    expect(segunda.endsWith('-2')).toBe(true);
    expect(formatoDaChaveValido(segunda)).toBe(true);
  });
});

describe('novaChave: todo resultado tem formato válido', () => {
  const tipos = [1, 10, 31, 32, 33, 63, 64].map((tamanho) => 'a'.repeat(tamanho));
  const nomes = ['', '!!!', '2ª chamada', 'x'.repeat(70), `1${'y'.repeat(70)}`, 'Prova escrita'];

  it('vale para tipos e nomes de vários tamanhos, também em colisão repetida', () => {
    for (const tipo of tipos) {
      for (const nome of nomes) {
        const tomadas = new Set<string>();
        for (let rodada = 0; rodada < 12; rodada++) {
          const chave = novaChave({ tipo, nome, tomadas });

          expect(formatoDaChaveValido(chave), chave).toBe(true);
          expect(tomadas.has(chave)).toBe(false);
          tomadas.add(chave);
        }
      }
    }
  });
});

describe('formatoDaChaveValido', () => {
  it.each(['a', 'etapa-1', 'prova-escrita-2', 'a1-b2', 'a'.repeat(64)])('aceita %s', (chave) => {
    expect(formatoDaChaveValido(chave)).toBe(true);
  });

  it.each([
    ['maiúscula', 'Etapa'],
    ['sublinhado', 'etapa_1'],
    ['hífen duplo', 'etapa--1'],
    ['hífen no fim', 'etapa-'],
    ['hífen no início', '-etapa'],
    ['começa por dígito', '1etapa'],
    ['vazia', ''],
    ['acento', 'avaliação'],
    ['65 caracteres', 'a'.repeat(65)],
  ])('recusa chave com %s', (_motivo, chave) => {
    expect(formatoDaChaveValido(chave)).toBe(false);
  });
});
