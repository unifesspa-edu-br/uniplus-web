import { describe, expect, it } from 'vitest';

import { escopoDoEnem } from './escopo-do-enem';

function etapa(id: string, notaDeOrigemNoEnem: boolean) {
  return { id, nome: `Etapa ${id}`, tipoEtapa: { notaDeOrigemNoEnem } };
}

function configuracao(etapas: ReturnType<typeof etapa>[], edicoes: readonly string[]): unknown {
  return {
    etapas,
    fatosColetados: [
      { fatoCodigo: 'OUTRO_FATO', valoresSelecionaveis: [{ valorCodigo: 'x', ordem: 1 }] },
      {
        fatoCodigo: 'EDICAO_ENEM',
        valoresSelecionaveis: edicoes.map((valorCodigo, i) => ({
          valorCodigo,
          ordem: edicoes.length - i,
        })),
      },
    ],
  };
}

describe('escopoDoEnem', () => {
  it('toma como etapa a que recebe a nota do ENEM e ordena as edições congeladas', () => {
    const escopo = escopoDoEnem(
      configuracao([etapa('a', false), etapa('b', true)], ['2026', '2025']),
    );

    expect(escopo).toEqual({
      situacao: 'pronto',
      etapa: { id: 'b', nome: 'Etapa b' },
      edicoes: ['2025', '2026'],
    });
  });

  it('sem etapa de nota do ENEM, não há onde importar', () => {
    expect(escopoDoEnem(configuracao([etapa('a', false)], ['2025'])).situacao).toBe('semEtapa');
  });

  it('sem edições congeladas, não há o que escolher', () => {
    expect(escopoDoEnem(configuracao([etapa('b', true)], [])).situacao).toBe('semEdicoes');
  });

  it('uma configuração que não é objeto não tem etapa', () => {
    expect(escopoDoEnem(null).situacao).toBe('semEtapa');
  });
});
