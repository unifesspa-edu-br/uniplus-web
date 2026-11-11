import { describe, expect, it } from 'vitest';
import { avisoDaVersaoDoLink, encerradaForaDoAvisoDoLink } from './aviso-da-versao-do-link';
import { perfilDoDetalhe, versaoPendente } from './perfis.testing';

const encerrada = (situacao: string) => ({
  numero: 3,
  situacao,
  etapa: 'protecao_de_dados',
  instante: '2026-11-03T12:00:00Z',
});

describe('avisoDaVersaoDoLink', () => {
  it('não avisa sem versão no link nem quando ela é a pendente', () => {
    const perfil = perfilDoDetalhe({ versaoPendente: versaoPendente() });

    expect(avisoDaVersaoDoLink(perfil, undefined)).toBeNull();
    expect(avisoDaVersaoDoLink(perfil, 'v2')).toBeNull();
  });

  it('diz que a versão do link já está em vigor', () => {
    expect(avisoDaVersaoDoLink(perfilDoDetalhe(), 'v1')).toContain('aprovada e está em vigor');
  });

  it.each([
    ['recusada', 'A última versão proposta, a 3, foi recusada.'],
    ['cancelada', 'A última versão proposta, a 3, foi cancelada.'],
    ['expirada', 'A última versão proposta, a 3, foi encerrada por expiração.'],
  ])('sem pendente, usa a última versão encerrada (%s)', (situacao, texto) => {
    const perfil = perfilDoDetalhe({ ultimaVersaoEncerradaSemVigor: encerrada(situacao) });

    expect(avisoDaVersaoDoLink(perfil, 'v3')).toContain(texto);
  });

  it('sem versão encerrada conhecida, usa o texto neutro', () => {
    expect(avisoDaVersaoDoLink(perfilDoDetalhe({ composicaoEmVigor: null }), 'vx')).toBe(
      'Esta versão não está mais pendente. Abaixo está a situação atual do perfil.',
    );
  });

  describe('encerradaForaDoAvisoDoLink', () => {
    it('devolve a encerrada quando o aviso do link não a cita', () => {
      const perfil = perfilDoDetalhe({ ultimaVersaoEncerradaSemVigor: encerrada('recusada') });

      expect(encerradaForaDoAvisoDoLink(perfil, 'v1')?.numero).toBe(3);
      expect(encerradaForaDoAvisoDoLink(perfil, undefined)?.numero).toBe(3);
    });

    it('não repete a encerrada que o aviso do link já cita', () => {
      const perfil = perfilDoDetalhe({ ultimaVersaoEncerradaSemVigor: encerrada('cancelada') });

      expect(encerradaForaDoAvisoDoLink(perfil, 'v3')).toBeNull();
    });
  });
});
