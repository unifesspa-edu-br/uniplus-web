import type { CausaDeCampo } from '@uniplus/shared-core/http';
import { describe, expect, it } from 'vitest';

import { recusasDaFormula } from './recusas-da-formula';

const FORA_DO_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_fora_do_quadro';
const SEM_QUADRO = 'uniplus.selecao.processo_seletivo.desempate_area_enem_sem_quadro';

function causa(field: string, code: string, message: string): CausaDeCampo {
  return { field, code, message };
}

describe('recusasDaFormula', () => {
  it('sem causa no campo da resolução, ela não é julgada', () => {
    const recusas = recusasDaFormula([causa('casasArredondamento', 'a', 'Das casas.')]);

    expect(recusas.daResolucao).toEqual({ julgada: false });
  });

  it('com só causas de desempate no campo da resolução, ela é julgada sem recusa', () => {
    const recusas = recusasDaFormula([
      causa('resolucaoPesoAreaEnem', FORA_DO_QUADRO, 'Do critério.'),
    ]);

    expect(recusas.daResolucao).toEqual({ julgada: true, recusa: null });
  });

  it('com causa da resolução que não é de desempate, guarda a primeira, como veio', () => {
    const recusas = recusasDaFormula([
      causa('resolucaoPesoAreaEnem', FORA_DO_QUADRO, 'Do critério.'),
      causa('resolucaoPesoAreaEnem', 'outra', 'a primeira da resolução'),
      causa('resolucaoPesoAreaEnem', 'outra', 'A segunda.'),
    ]);

    expect(recusas.daResolucao).toEqual({ julgada: true, recusa: 'a primeira da resolução' });
  });

  it.each(['baseadoEmEnem', 'regraCalculoCodigo', 'resolucaoPesoAreaEnem', 'qualquerOutro'])(
    'reconhece o desempate pelo código no campo %s',
    (campo) => {
      const recusas = recusasDaFormula([causa(campo, SEM_QUADRO, 'Mensagem do critério.')]);

      expect(recusas.peloDesempate).toBe('Mensagem do critério.');
    },
  );

  it('junta as mensagens distintas de dois critérios, uma vez cada', () => {
    const recusas = recusasDaFormula([
      causa('baseadoEmEnem', SEM_QUADRO, 'Critério da ordem 1.'),
      causa('regraCalculoCodigo', SEM_QUADRO, 'Critério da ordem 2.'),
      causa('resolucaoPesoAreaEnem', FORA_DO_QUADRO, 'Critério da ordem 1.'),
    ]);

    expect(recusas.peloDesempate).toBe('Critério da ordem 1. Critério da ordem 2.');
  });

  it('sem código de desempate, a recusa pelo desempate não vem', () => {
    const recusas = recusasDaFormula([causa('resolucaoPesoAreaEnem', 'outra', 'Da resolução.')]);

    expect(recusas.peloDesempate).toBeNull();
  });

  it('a escala é a mensagem da causa do campo; sem causa dela, não vem', () => {
    expect(recusasDaFormula([causa('escalaNotaFinal', 'a', 'Da escala.')]).daEscala).toBe(
      'Da escala.',
    );
    expect(recusasDaFormula([]).daEscala).toBeNull();
  });

  it('causa de desempate no campo da escala não é recusa da escala; a própria da escala fica com a dela', () => {
    const recusas = recusasDaFormula([
      causa('escalaNotaFinal', SEM_QUADRO, 'Do critério.'),
      causa('escalaNotaFinal', 'a', 'Da escala.'),
    ]);

    expect(recusas.daEscala).toBe('Da escala.');
    expect(recusas.peloDesempate).toBe('Do critério.');
  });

  it('só causa de desempate no campo da escala: a escala não tem recusa', () => {
    const recusas = recusasDaFormula([causa('escalaNotaFinal', FORA_DO_QUADRO, 'Do critério.')]);

    expect(recusas.daEscala).toBeNull();
  });
});
