import { describe, expect, it } from 'vitest';

import { recusaAoGravarODesempate } from './recusas-do-desempate';
import { CANONICAS, criterio } from './quadro-do-desempate.testing';

describe('recusaAoGravarODesempate', () => {
  const PREFIXO = 'uniplus.selecao.processo_seletivo.';
  const criterios = [criterio(['REDACAO']), criterio(['MATEMATICA', 'REDACAO'])];
  const rotulo = (codigo: string) =>
    CANONICAS.find((area) => area.codigo === codigo)?.rotulo ?? codigo;

  it('diz o critério e a área que o campo aponta', () => {
    expect(
      recusaAoGravarODesempate(
        { field: 'criterios[1].areas[0]', code: `${PREFIXO}desempate_area_enem_fora_do_quadro` },
        criterios,
        rotulo,
      ),
    ).toBe(
      'Critério de desempate 2: a área Matemática não é comum a todos os grupos da resolução de Peso por Área.',
    );
  });

  it('a área citada por outro critério diz qual é o outro', () => {
    expect(
      recusaAoGravarODesempate(
        { field: 'criterios[1].areas[1]', code: `${PREFIXO}area_enem_citada_por_outro_criterio` },
        criterios,
        rotulo,
      ),
    ).toBe('Critério de desempate 2: a área Redação já é citada pelo critério 1.');
  });

  it('a área repetida no mesmo critério continua "repetida"', () => {
    expect(
      recusaAoGravarODesempate(
        {
          field: 'criterios[0].areas[0]',
          code: 'uniplus.selecao.criterio_desempate.area_repetida',
        },
        criterios,
        rotulo,
      ),
    ).toBe(
      'Critério de desempate 1: a área Redação aparece mais de uma vez na ordem de desempate.',
    );
  });

  it('sem critério no campo, a frase começa pela maiúscula e fala de uma das áreas', () => {
    expect(
      recusaAoGravarODesempate(
        { field: 'criterios', code: `${PREFIXO}area_enem_citada_por_outro_criterio` },
        criterios,
        rotulo,
      ),
    ).toBe('Uma das áreas já é citada por outro critério de desempate.');
  });

  it('devolve null para o code que a tela não explica', () => {
    expect(
      recusaAoGravarODesempate({ field: 'criterios[0]', code: 'outro' }, criterios, rotulo),
    ).toBeNull();
  });
});
