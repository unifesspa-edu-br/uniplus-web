import { TestBed } from '@angular/core/testing';
import { Subject, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '@uniplus/shared-core/http';
import { OpcoesDoRecursoApi } from '@uniplus/shared-data/selecao';

import {
  EFEITOS_NA_API,
  GUARDAS_NA_API,
  UNIDADES_DO_PRAZO_NA_API,
} from '../../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
import { CatalogoDasOpcoesDoRecurso } from './catalogo-das-opcoes-do-recurso.service';
import { falhaDoServidor, pagina } from './catalogos.testing';

type Busca = () => Observable<ApiResult<readonly unknown[]>>;

interface Buscas {
  readonly unidades?: Busca;
  readonly efeitos?: Busca;
  readonly guardas?: Busca;
}

function catalogoCom({ unidades, efeitos, guardas }: Buscas = {}) {
  const api = {
    listarUnidadesDePrazo: vi.fn(unidades ?? (() => pagina(UNIDADES_DO_PRAZO_NA_API))),
    listarEfeitosSuspensivos: vi.fn(efeitos ?? (() => pagina(EFEITOS_NA_API))),
    listarGuardasDaVaga: vi.fn(guardas ?? (() => pagina(GUARDAS_NA_API))),
  };
  TestBed.configureTestingModule({
    providers: [CatalogoDasOpcoesDoRecurso, { provide: OpcoesDoRecursoApi, useValue: api }],
  });
  return { catalogo: TestBed.inject(CatalogoDasOpcoesDoRecurso), api };
}

describe('CatalogoDasOpcoesDoRecurso', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('carrega as unidades do prazo, os efeitos e as guardas como a API os devolve', () => {
    const { catalogo } = catalogoCom();

    catalogo.carregar();

    expect(catalogo.unidadesDePrazo()).toEqual(UNIDADES_DO_PRAZO_NA_API);
    expect(catalogo.efeitosSuspensivos()).toEqual(EFEITOS_NA_API);
    expect(catalogo.guardasDaVaga()).toEqual(GUARDAS_NA_API);
    expect(catalogo.carregando()).toBe(false);
    expect(catalogo.erro()).toBeNull();
  });

  it('chega sem opção alguma, carregando, até a primeira busca', () => {
    const { catalogo } = catalogoCom();

    expect(catalogo.situacaoDasUnidades()).toBe('carregando');
    expect(catalogo.unidadesDePrazo()).toEqual([]);
  });

  it('diz de cada lista, em separado, se está pronta', () => {
    const { catalogo } = catalogoCom();

    catalogo.carregar();

    expect(catalogo.situacaoDasUnidades()).toBe('pronta');
    expect(catalogo.situacaoDosEfeitos()).toBe('pronta');
    expect(catalogo.situacaoDasGuardas()).toBe('pronta');
  });

  it('enquanto uma lista não responde, só ela segue carregando', () => {
    const semResposta = new Subject<ApiResult<readonly unknown[]>>();
    const { catalogo } = catalogoCom({ efeitos: () => semResposta });

    catalogo.carregar();

    expect(catalogo.situacaoDosEfeitos()).toBe('carregando');
    expect(catalogo.situacaoDasUnidades()).toBe('pronta');
    expect(catalogo.carregando()).toBe(true);
  });

  it('uma lista que falha vira erro e deixa as outras servirem', () => {
    const { catalogo } = catalogoCom({ guardas: () => falhaDoServidor() });

    catalogo.carregar();

    expect(catalogo.erro()).toBe('Não foi possível carregar as guardas da vaga.');
    expect(catalogo.situacaoDasGuardas()).toBe('falhou');
    expect(catalogo.guardasDaVaga()).toEqual([]);
    expect(catalogo.situacaoDasUnidades()).toBe('pronta');
    expect(catalogo.unidadesDePrazo()).toEqual(UNIDADES_DO_PRAZO_NA_API);
    expect(catalogo.carregando()).toBe(false);
  });

  it('não repete a busca ao carregar duas vezes seguidas com sucesso', () => {
    const { catalogo, api } = catalogoCom();

    catalogo.carregar();
    catalogo.carregar();

    expect(api.listarUnidadesDePrazo).toHaveBeenCalledTimes(1);
    expect(api.listarEfeitosSuspensivos).toHaveBeenCalledTimes(1);
    expect(api.listarGuardasDaVaga).toHaveBeenCalledTimes(1);
  });

  it('busca as três listas de novo na nova tentativa depois da falha e limpa a mensagem', () => {
    let falhar = true;
    const { catalogo, api } = catalogoCom({
      efeitos: () => (falhar ? falhaDoServidor() : pagina(EFEITOS_NA_API)),
    });
    catalogo.carregar();
    falhar = false;

    catalogo.recarregar();

    expect(catalogo.erro()).toBeNull();
    expect(catalogo.efeitosSuspensivos()).toEqual(EFEITOS_NA_API);
    expect(api.listarUnidadesDePrazo).toHaveBeenCalledTimes(2);
    expect(api.listarGuardasDaVaga).toHaveBeenCalledTimes(2);
  });
});
