import { describe, expect, it } from 'vitest';
import { PERMISSAO, type PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { destinoDeVolta } from './destino-de-volta';

const { autorizacao } = PERMISSAO;

const com = (...concedidas: string[]): PermissoesService =>
  ({
    temAlguma: (...codigos: string[]) => codigos.some((c) => concedidas.includes(c)),
  }) as unknown as PermissoesService;

describe('destinoDeVolta', () => {
  it('com a permissão de manter perfis, volta à lista de perfis', () => {
    expect(
      destinoDeVolta(com(autorizacao.perfisManter, autorizacao.perfisAprovarProtecaoDeDados)),
    ).toEqual({ rota: '/acessos/perfis', rotulo: 'Ir para os perfis' });
  });

  it('sem manter, volta à fila de janelas da etapa que a pessoa tem', () => {
    expect(destinoDeVolta(com(autorizacao.perfisAprovarProtecaoDeDados)).rota).toBe(
      '/acessos/janelas-de-migracao/protecao-de-dados',
    );
  });

  it('com as duas etapas e sem manter, volta à fila da gestão de acessos', () => {
    expect(
      destinoDeVolta(
        com(autorizacao.perfisAprovarFuncional, autorizacao.perfisAprovarProtecaoDeDados),
      ),
    ).toEqual({
      rota: '/acessos/janelas-de-migracao/gestao-de-acessos',
      rotulo: 'Ir para as janelas de migração',
    });
  });

  it('sem nenhuma dessas permissões, volta ao início', () => {
    expect(destinoDeVolta(com())).toEqual({ rota: '/', rotulo: 'Ir para o início' });
  });
});
