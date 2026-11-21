import { describe, expect, it } from 'vitest';

import { localDaRecusa } from '../../shared/recusas/local-da-recusa';
import { campoDaRecusaDaFase } from './campo-da-fase';

const campoDe = (field: string) => {
  const local = localDaRecusa(field);
  return local === null ? null : campoDaRecusaDaFase(local);
};

describe('campoDaRecusaDaFase', () => {
  it.each([
    ['fases[0].produtos[1].atoCodigo', 'produtos'],
    ['fases[0].produtos', 'produtos'],
    ['fases[0].emiteParecerIndividual', 'emiteParecerIndividual'],
    ['fases[0].inicio', 'inicio'],
    ['fases[0].fim', 'fim'],
    ['fases[1].unidadeResponsavelId', 'unidadeResponsavelId'],
  ])('leva %s ao campo %s', (field, campo) => {
    expect(campoDe(field)).toBe(campo);
  });

  it.each([
    'fases[0].bancasRequeridas[2]',
    'fases[0].bancasRequeridas[0].regraDeDeliberacao.quorum',
  ])('reúne sob as bancas requeridas o caminho %s', (field) => {
    expect(campoDe(field)).toBe('bancasRequeridas');
  });

  it.each([
    ['fases[0].regraRecurso.regraCodigo', 'recurso.regra'],
    ['fases[0].regraRecurso.prazoValor', 'recurso.prazo'],
    ['fases[0].regraRecurso.prazoUnidade', 'recurso.prazo'],
    ['fases[0].regraRecurso.atoAncoraCodigo', 'recurso.ancora'],
    ['fases[0].regraRecurso.admiteInstanciaSuperior', 'recurso.admiteInstanciaSuperior'],
    [
      'fases[0].regraRecurso.suspensividadePrimeiraInstanciaValor',
      'recurso.suspensividadePrimeiraInstancia',
    ],
    [
      'fases[0].regraRecurso.suspensividadeSegundaInstanciaUnidade',
      'recurso.suspensividadeSegundaInstancia',
    ],
  ])('leva %s ao campo %s da regra de recurso', (field, campo) => {
    expect(campoDe(field)).toBe(campo);
  });

  it('leva à regra de recurso inteira o campo dela que a tela não mostra', () => {
    expect(campoDe('fases[0].regraRecurso.procedimentosDeRecurso')).toBe('recurso');
    expect(campoDe('fases[0].regraRecurso')).toBe('recurso');
  });

  it.each(['fases[0]', 'fases[0].tiposDeDecisao[0]', 'fases[0].bancas[x]', 'fases[0].codigo'])(
    'não aponta campo em %s, e a recusa fica no topo da fase',
    (field) => {
      expect(campoDe(field)).toBeNull();
    },
  );

  it('não aponta campo da fase para a recusa de uma etapa', () => {
    expect(campoDe('etapas[0].produtos')).toBeNull();
  });

  it('lê o campo sem distinguir a caixa que a API usa', () => {
    expect(campoDe('request.Fases[0].UnidadeResponsavelId')).toBe('unidadeResponsavelId');
  });
});
