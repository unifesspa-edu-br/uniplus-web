import { describe, expect, it } from 'vitest';
import { codigoDoContrato, codigoExigidoDoContrato } from './codigo-do-contrato';

enum SituacaoDeTeste {
  ABERTA = 'ABERTA',
  ENCERRADA = 'ENCERRADA',
}

describe('codigoDoContrato', () => {
  it('devolve o membro do enum que tem o código', () => {
    expect(codigoDoContrato(SituacaoDeTeste, 'ENCERRADA')).toBe(SituacaoDeTeste.ENCERRADA);
  });

  it('devolve null quando o contrato não conhece o código', () => {
    expect(codigoDoContrato(SituacaoDeTeste, 'SUSPENSA')).toBeNull();
  });

  it('não confunde o nome do membro com o código quando os dois diferem', () => {
    enum Parecer {
      FAVORAVEL = 'APTO',
    }
    expect(codigoDoContrato(Parecer, 'FAVORAVEL')).toBeNull();
    expect(codigoDoContrato(Parecer, 'APTO')).toBe(Parecer.FAVORAVEL);
  });

  it('recusa o texto vazio', () => {
    expect(codigoDoContrato(SituacaoDeTeste, '')).toBeNull();
  });
});

describe('codigoExigidoDoContrato', () => {
  it('devolve o código válido', () => {
    expect(codigoExigidoDoContrato(SituacaoDeTeste, 'ENCERRADA', 'situação')).toBe(
      SituacaoDeTeste.ENCERRADA,
    );
  });

  it.each(['SUSPENSA', ''])('recusa valor desconhecido ou vazio sem expô-lo', (valor) => {
    expect(() => codigoExigidoDoContrato(SituacaoDeTeste, valor, 'situação')).toThrow(
      'O valor informado para situação é inválido.',
    );
  });
});
