import { prazoDoPerfil, type PerfilConcedido } from './perfil-concedido.model';

function comPrazo(validaAte: string | null): PerfilConcedido {
  return {
    concessaoId: 'c-1',
    perfilId: 'p-1',
    nome: 'Gestor de processo seletivo',
    escopoTipo: 'unidade',
    unidadeId: 'u-1',
    unidadeSigla: 'CEPS',
    unidadeNome: 'Centro de Processos Seletivos',
    validaAte,
  };
}

describe('prazoDoPerfil', () => {
  it('mostra o dia no fuso institucional, não no do navegador', () => {
    // 23:59 em Brasília já é o dia seguinte em UTC; o prazo continua sendo 31/12.
    expect(prazoDoPerfil(comPrazo('2026-12-31T23:59:00-03:00'))).toBe('31/12/2026');
    expect(prazoDoPerfil(comPrazo('2027-01-01T02:30:00Z'))).toBe('31/12/2026');
  });

  it('não tem prazo quando a concessão não vence ou a data é ilegível', () => {
    expect(prazoDoPerfil(comPrazo(null))).toBeNull();
    expect(prazoDoPerfil(comPrazo('não é data'))).toBeNull();
  });
});
