import { describe, expect, it } from 'vitest';

import {
  mensagensDaRegraDePcd,
  mensagensDeFatosSemOferta,
} from './mensagens-de-validacao-do-atendimento';

describe('mensagens de validação do atendimento', () => {
  it('gera uma mensagem por fato do formulário sem valor ofertado', () => {
    const mensagens = mensagensDeFatosSemOferta(['a condição de atendimento', 'o recurso']);

    expect(mensagens).toHaveLength(2);
    expect(mensagens[0]).toContain('pergunta a condição de atendimento ao candidato');
  });

  it('recusa tipos de deficiência sem a condição PcD', () => {
    expect(mensagensDaRegraDePcd(1, false)[0]).toContain('exigem a condição');
  });

  it('recusa a condição PcD sem tipo de deficiência', () => {
    expect(mensagensDaRegraDePcd(0, true)[0]).toContain('exige ao menos um tipo');
  });

  it.each([
    [0, false],
    [2, true],
  ])('aceita %i tipos com a condição PcD selecionada = %s', (tipos, pcd) => {
    expect(mensagensDaRegraDePcd(tipos, pcd)).toEqual([]);
  });
});
