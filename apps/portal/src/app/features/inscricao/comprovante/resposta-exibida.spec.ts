import { describe, expect, it } from 'vitest';

import { nomesDoCandidato } from './resposta-exibida';

describe('nomesDoCandidato', () => {
  const civil = 'Fernanda Laura Nicole Drumond';

  it('traz o nome social quando o candidato o pediu e o preencheu, sempre com o civil', () => {
    expect(
      nomesDoCandidato({ NOME: civil, DESEJA_NOME_SOCIAL: true, NOME_SOCIAL: 'Ariel Drumond' }),
    ).toEqual({ social: 'Ariel Drumond', civil });
  });

  it('não traz nome social que o candidato não pediu ou deixou em branco', () => {
    expect(
      nomesDoCandidato({ NOME: civil, DESEJA_NOME_SOCIAL: false, NOME_SOCIAL: 'Ariel Drumond' }),
    ).toEqual({ social: null, civil });
    expect(nomesDoCandidato({ NOME: civil, DESEJA_NOME_SOCIAL: true, NOME_SOCIAL: '' })).toEqual({
      social: null,
      civil,
    });
  });
});
