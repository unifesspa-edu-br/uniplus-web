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

  it.each([
    ['aprova a proteção de dados', autorizacao.perfisAprovarProtecaoDeDados],
    ['aprova pela gestão de acessos', autorizacao.perfisAprovarFuncional],
  ])('quem só %s também volta à lista de perfis', (_quem, permissao) => {
    expect(destinoDeVolta(com(permissao))).toEqual({
      rota: '/acessos/perfis',
      rotulo: 'Ir para os perfis',
    });
  });

  it('sem nenhuma dessas permissões, volta ao início', () => {
    expect(destinoDeVolta(com())).toEqual({ rota: '/', rotulo: 'Ir para o início' });
  });
});
