import { describe, expect, it } from 'vitest';

import { opcoesDaEdicao } from './edicoes-da-condicao';

const rotulo = (ano: string): string => `ENEM ${ano}`;

describe('opcoesDaEdicao', () => {
  it('oferece as edições declaradas, na ordem declarada, todas marcadas como declaradas', () => {
    expect(opcoesDaEdicao(['2024', '2025', '2026'], 2025, rotulo)).toStrictEqual([
      { valor: 2024, rotulo: 'ENEM 2024', declarada: true },
      { valor: 2025, rotulo: 'ENEM 2025', declarada: true },
      { valor: 2026, rotulo: 'ENEM 2026', declarada: true },
    ]);
  });

  it('oferece as declaradas quando a condição ainda não escolheu edição', () => {
    expect(opcoesDaEdicao(['2025'], null, rotulo)).toStrictEqual([
      { valor: 2025, rotulo: 'ENEM 2025', declarada: true },
    ]);
  });

  it('mantém ao fim, marcada, a edição escolhida que o processo deixou de declarar', () => {
    expect(opcoesDaEdicao(['2025', '2026'], 2023, rotulo)).toStrictEqual([
      { valor: 2025, rotulo: 'ENEM 2025', declarada: true },
      { valor: 2026, rotulo: 'ENEM 2026', declarada: true },
      { valor: 2023, rotulo: 'ENEM 2023', declarada: false },
    ]);
  });

  it('mostra só a edição escolhida, marcada, quando o processo não declara nenhuma', () => {
    expect(opcoesDaEdicao([], 2023, rotulo)).toStrictEqual([
      { valor: 2023, rotulo: 'ENEM 2023', declarada: false },
    ]);
  });

  it('não oferece nada quando não há edição declarada nem escolhida', () => {
    expect(opcoesDaEdicao([], null, rotulo)).toStrictEqual([]);
  });

  it('não repete a edição escolhida que já está declarada', () => {
    expect(opcoesDaEdicao(['2025'], 2025, rotulo)).toHaveLength(1);
  });

  it('ignora a edição declarada que não é um ano', () => {
    expect(opcoesDaEdicao(['2025', 'ENEM'], null, rotulo)).toStrictEqual([
      { valor: 2025, rotulo: 'ENEM 2025', declarada: true },
    ]);
  });

  it('usa o rótulo que quem chama informa', () => {
    const opcoes = opcoesDaEdicao(['2025'], null, (ano) => `Exame de ${ano}`);

    expect(opcoes[0].rotulo).toBe('Exame de 2025');
  });
});
