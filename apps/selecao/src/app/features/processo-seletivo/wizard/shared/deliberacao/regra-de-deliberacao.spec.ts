import {
  MODOS,
  CRITERIOS,
  DESEMPATES,
  ENCERRAMENTOS,
  RESULTADOS,
} from './regra-de-deliberacao.testing';
import { describe, expect, it } from 'vitest';

import {
  alterarRegra,
  controlesAVista,
  normalizarRegra,
  pedeDesempate,
  pedeResultadoSemUnanimidade,
  quorumSegueOsIntegrantes,
  regraNova,
} from './regra-de-deliberacao';
import { COLEGIADA, comRegra } from './regra-de-deliberacao.testing';

describe('regraNova', () => {
  it('começa a colegiada sem nada escolhido e sem suplentes', () => {
    expect(regraNova(MODOS.colegiadaComVotacao.codigo)).toEqual({
      modo: MODOS.colegiadaComVotacao.codigo,
      integrantes: '',
      suplentes: '0',
      quorum: '',
      criterio: '',
      desempate: '',
      encerramento: '',
      semUnanimidade: '',
    });
  });

  it('começa o ato individual sem nenhum campo de votação', () => {
    expect(regraNova(MODOS.atoIndividual.codigo)).toMatchObject({
      modo: MODOS.atoIndividual.codigo,
      quorum: '',
      criterio: '',
      encerramento: '',
    });
  });
});

describe('normalizarRegra', () => {
  it('mantém a votação no ato individual', () => {
    const regra = normalizarRegra(comRegra({ modo: MODOS.atoIndividual.codigo }));

    expect(regra).toMatchObject({
      quorum: '3',
      criterio: CRITERIOS.maioriaSimples.codigo,
      desempate: DESEMPATES.votoDaPresidencia.codigo,
      encerramento: ENCERRAMENTOS.presidenciaNoQuorum.codigo,
      semUnanimidade: '',
    });
  });

  it('iguala o quórum aos integrantes quando todos os titulares votam', () => {
    const regra = normalizarRegra(
      comRegra({ encerramento: ENCERRAMENTOS.todosOsTitulares.codigo, quorum: '2' }),
    );

    expect(regra.quorum).toBe('5');
  });

  it('mantém o quórum digitado quando a presidência encerra ao atingi-lo', () => {
    expect(normalizarRegra(COLEGIADA).quorum).toBe('3');
  });

  it('tira o desempate da unanimidade e o resultado sem unanimidade da maioria', () => {
    const unanimidade = normalizarRegra(comRegra({ criterio: CRITERIOS.unanimidade.codigo }));
    const maioria = normalizarRegra(comRegra({ semUnanimidade: RESULTADOS.favoravel.codigo }));

    expect(unanimidade.desempate).toBe('');
    expect(maioria.semUnanimidade).toBe('');
  });

  it('tira desempate e resultado sem unanimidade quando só há um integrante', () => {
    const maioria = normalizarRegra(comRegra({ integrantes: '1' }));
    const unanimidade = normalizarRegra(
      comRegra({
        integrantes: '1',
        criterio: CRITERIOS.unanimidade.codigo,
        semUnanimidade: RESULTADOS.desfavoravel.codigo,
      }),
    );

    expect(maioria.desempate).toBe('');
    expect(unanimidade.semUnanimidade).toBe('');
  });

  it('guarda o desempate enquanto o número de integrantes ainda não foi digitado', () => {
    expect(normalizarRegra(comRegra({ integrantes: '' })).desempate).toEqual(
      DESEMPATES.votoDaPresidencia.codigo,
    );
  });
});

describe('alterarRegra', () => {
  it('troca o critério e já descarta o desempate que ele não admite', () => {
    const regra = alterarRegra(COLEGIADA, 'criterio', CRITERIOS.unanimidade.codigo);

    expect(regra.criterio).toEqual(CRITERIOS.unanimidade.codigo);
    expect(regra.desempate).toBe('');
  });

  it('preserva a votação ao trocar de modo e voltar', () => {
    const regra = alterarRegra(COLEGIADA, 'modo', MODOS.atoIndividual.codigo);

    expect(regra).toEqual({ ...COLEGIADA, modo: MODOS.atoIndividual.codigo });
    expect(alterarRegra(regra, 'modo', MODOS.colegiadaComVotacao.codigo)).toEqual(COLEGIADA);
  });

  it('acompanha o número de integrantes no quórum que não se digita', () => {
    const fixa = comRegra({ encerramento: ENCERRAMENTOS.todosOsTitulares.codigo, quorum: '5' });

    expect(alterarRegra(fixa, 'integrantes', '7').quorum).toBe('7');
  });
});

describe('o que a regra pede', () => {
  it('pede desempate só na maioria com mais de um integrante', () => {
    expect(pedeDesempate(COLEGIADA)).toBe(true);
    expect(pedeDesempate(comRegra({ criterio: CRITERIOS.unanimidade.codigo }))).toBe(false);
    expect(pedeDesempate(comRegra({ integrantes: '1' }))).toBe(false);
    expect(pedeDesempate(comRegra({ modo: MODOS.atoIndividual.codigo }))).toBe(true);
  });

  it('pede o resultado sem unanimidade só na unanimidade com mais de um integrante', () => {
    expect(pedeResultadoSemUnanimidade(comRegra({ criterio: CRITERIOS.unanimidade.codigo }))).toBe(
      true,
    );
    expect(pedeResultadoSemUnanimidade(COLEGIADA)).toBe(false);
    expect(
      pedeResultadoSemUnanimidade(
        comRegra({ modo: MODOS.atoIndividual.codigo, criterio: CRITERIOS.unanimidade.codigo }),
      ),
    ).toBe(true);
    expect(
      pedeResultadoSemUnanimidade(
        comRegra({ criterio: CRITERIOS.unanimidade.codigo, integrantes: '1' }),
      ),
    ).toBe(false);
  });

  it('fixa o quórum só quando todos os titulares votam', () => {
    expect(
      quorumSegueOsIntegrantes(comRegra({ encerramento: ENCERRAMENTOS.todosOsTitulares.codigo })),
    ).toBe(true);
    expect(quorumSegueOsIntegrantes(COLEGIADA)).toBe(false);
    expect(
      quorumSegueOsIntegrantes(
        comRegra({
          modo: MODOS.atoIndividual.codigo,
          encerramento: ENCERRAMENTOS.todosOsTitulares.codigo,
        }),
      ),
    ).toBe(true);
  });
});

describe('controlesAVista', () => {
  const aVista = (regra: Parameters<typeof controlesAVista>[0]) => [...controlesAVista(regra)];

  it('mostra só o modo quando a banca não declarou regra', () => {
    expect(aVista(null)).toEqual(['modo']);
  });

  it('mostra o desempate da maioria, e não o resultado sem unanimidade', () => {
    expect(aVista(COLEGIADA)).toEqual(
      expect.arrayContaining(['modo', 'integrantes', 'suplentes', 'encerramento', 'quorum']),
    );
    expect(aVista(COLEGIADA)).toContain('desempate');
    expect(aVista(COLEGIADA)).not.toContain('semUnanimidade');
  });

  it('mostra o resultado sem unanimidade da unanimidade, e não o desempate', () => {
    const regra = comRegra({ criterio: CRITERIOS.unanimidade.codigo, desempate: '' });

    expect(aVista(regra)).toContain('semUnanimidade');
    expect(aVista(regra)).not.toContain('desempate');
  });

  it('dispensa o desempate e o resultado sem unanimidade de um só integrante', () => {
    expect(aVista(comRegra({ integrantes: '1' }))).not.toContain('desempate');
    expect(
      aVista(comRegra({ criterio: CRITERIOS.unanimidade.codigo, integrantes: '1' })),
    ).not.toContain('semUnanimidade');
  });

  it('não mostra nenhum dos dois enquanto o critério não foi escolhido', () => {
    const escolhidos = aVista(comRegra({ criterio: '', desempate: '' }));

    expect(escolhidos).not.toContain('desempate');
    expect(escolhidos).not.toContain('semUnanimidade');
  });
});
