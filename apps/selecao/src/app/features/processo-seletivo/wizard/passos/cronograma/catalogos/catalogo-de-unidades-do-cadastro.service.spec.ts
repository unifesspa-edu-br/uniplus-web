import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { apiOk, type ApiResult } from '@uniplus/shared-core/http';
import { UnidadesApi, type UnidadeDto } from '@uniplus/shared-data/organizacao';

import { CatalogoDeUnidadesDoCadastro } from './catalogo-de-unidades-do-cadastro.service';
import { falhaDoServidor, pagina } from './catalogos.testing';

const CGA = { id: 'unidade-cga', sigla: 'CGA', nome: 'Centro de Gestão Acadêmica' } as UnidadeDto;

function montar(listar: () => Observable<ApiResult<readonly UnidadeDto[]>>) {
  TestBed.configureTestingModule({
    providers: [CatalogoDeUnidadesDoCadastro, { provide: UnidadesApi, useValue: { listar } }],
  });
  return TestBed.inject(CatalogoDeUnidadesDoCadastro);
}

describe('CatalogoDeUnidadesDoCadastro', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('indexa as unidades do cadastro pelo id', () => {
    const catalogo = montar(() => pagina([CGA]));

    catalogo.carregar();

    expect(catalogo.opcoes()).toEqual([
      { id: 'unidade-cga', rotulo: 'CGA — Centro de Gestão Acadêmica' },
    ]);
    expect(catalogo.carregada()).toBe(true);
    expect(catalogo.erro()).toBeNull();
  });

  it('anuncia a falha da listagem e não se dá por carregado', () => {
    const catalogo = montar(() => falhaDoServidor());

    catalogo.carregar();

    expect(catalogo.erro()).toBe('Não foi possível carregar as unidades.');
    expect(catalogo.carregada()).toBe(false);
  });

  /** Uma resposta atrasada de carregamento anterior não pode desfazer a lista mais nova. */
  it('descarta a resposta do carregamento anterior quando outro já foi pedido', () => {
    const respostas: Subject<ApiResult<readonly UnidadeDto[]>>[] = [];
    const catalogo = montar(() => {
      const resposta = new Subject<ApiResult<readonly UnidadeDto[]>>();
      respostas.push(resposta);
      return resposta;
    });
    catalogo.carregar();
    catalogo.recarregar();

    respostas[1]?.next(apiOk([CGA], 200, new HttpHeaders()));
    respostas[1]?.complete();
    respostas[0]?.next(apiOk([], 200, new HttpHeaders()));

    expect(catalogo.unidades()).toEqual([CGA]);
  });
});
