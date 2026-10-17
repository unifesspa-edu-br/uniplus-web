import { describe, expect, it } from 'vitest';

import { nomesDoCandidato } from './resposta-exibida';

describe('nomesDoCandidato', () => {
  const civil = 'Fernanda Laura Nicole Drumond';

  it('traz o nome social quando o candidato o pediu e o preencheu, sempre com o civil', () => {
    expect(
      nomesDoCandidato({ NOME: civil, DESEJA_NOME_SOCIAL: true, NOME_SOCIAL: 'Ariel Drumond' }),
    ).toEqual({ usoDoNomeSocial: true, social: 'Ariel Drumond', civil });
  });

  it('não traz nome social que o candidato não pediu ou deixou em branco', () => {
    expect(
      nomesDoCandidato({ NOME: civil, DESEJA_NOME_SOCIAL: false, NOME_SOCIAL: 'Ariel Drumond' }),
    ).toEqual({ usoDoNomeSocial: false, social: null, civil });
    expect(nomesDoCandidato({ NOME: civil, DESEJA_NOME_SOCIAL: true, NOME_SOCIAL: '' })).toEqual({
      usoDoNomeSocial: true,
      social: null,
      civil,
    });
  });

  it('não registra o uso do nome social quando o formulário não o coleta', () => {
    expect(nomesDoCandidato({ NOME: civil })).toEqual({
      usoDoNomeSocial: null,
      social: null,
      civil,
    });
  });
});
