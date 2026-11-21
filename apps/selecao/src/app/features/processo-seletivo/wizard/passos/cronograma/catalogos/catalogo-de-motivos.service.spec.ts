import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotivosDeDecisaoApi, TipoMotivoDeDecisaoCodigo } from '@uniplus/shared-data/selecao';

import { umMotivoDoCadastro } from '../../../shared/motivos/motivos.testing';
import { CatalogoDeMotivos } from './catalogo-de-motivos.service';
import { falhaDoServidor, pagina } from './catalogos.testing';

function catalogoCom(listar: () => ReturnType<typeof pagina> | ReturnType<typeof falhaDoServidor>) {
  TestBed.configureTestingModule({
    providers: [CatalogoDeMotivos, { provide: MotivosDeDecisaoApi, useValue: { listar } }],
  });
  return TestBed.inject(CatalogoDeMotivos);
}

describe('CatalogoDeMotivos', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('carrega os motivos de todos os tipos, na ordem do cadastro', () => {
    const catalogo = catalogoCom(() =>
      pagina([
        umMotivoDoCadastro({ codigo: 'A', tipo: TipoMotivoDeDecisaoCodigo.ISENCAO_DA_TAXA }),
        umMotivoDoCadastro({ codigo: 'B', tipo: TipoMotivoDeDecisaoCodigo.CLASSIFICACAO }),
      ]),
    );

    catalogo.carregar();

    expect(catalogo.motivos().map((motivo) => motivo.codigo)).toEqual(['A', 'B']);
    expect(catalogo.carregando()).toBe(false);
  });

  it('pede também os motivos desativados e traz a marca de cada um', () => {
    const listar = vi.fn(() => pagina([umMotivoDoCadastro({ ativo: false })]));
    const catalogo = catalogoCom(listar);

    catalogo.carregar();

    expect(listar).toHaveBeenCalledWith(expect.objectContaining({ apenasAtivos: false }));
    expect(catalogo.motivos()[0].ativo).toBe(false);
  });

  it('guarda a mensagem de falha quando o servidor recusa e deixa a lista vazia', () => {
    const catalogo = catalogoCom(() => falhaDoServidor());

    catalogo.carregar();

    expect(catalogo.erro()).toBe('Não foi possível carregar os motivos de decisão.');
    expect(catalogo.motivos()).toEqual([]);
    expect(catalogo.carregando()).toBe(false);
  });

  it('busca de novo na nova tentativa depois da falha e limpa a mensagem', () => {
    let falhar = true;
    const catalogo = catalogoCom(() =>
      falhar ? falhaDoServidor() : pagina([umMotivoDoCadastro({ codigo: 'A' })]),
    );
    catalogo.carregar();
    falhar = false;

    catalogo.recarregar();

    expect(catalogo.erro()).toBeNull();
    expect(catalogo.motivos().map((motivo) => motivo.codigo)).toEqual(['A']);
  });

  it('não repete a busca ao carregar duas vezes seguidas com sucesso', () => {
    const listar = vi.fn(() => pagina([]));
    const catalogo = catalogoCom(listar);

    catalogo.carregar();
    catalogo.carregar();

    expect(listar).toHaveBeenCalledTimes(1);
  });
});
