import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ESPERA_DA_BUSCA_MS } from './decisoes-da-protecao.component';
import {
  APROVAR,
  URL_DAS_DECISOES as DECISOES,
  abrirAbaDeDecisoes,
  compilarPaginaUmaVez,
  decisaoDoFato,
  decisaoDoTipo,
  montarPagina,
  type PaginaMontada,
} from './protecao-do-catalogo.testing';

describe('ProtecaoDoCatalogoPage — busca das decisões', () => {
  beforeAll(compilarPaginaUmaVez);
  let pagina: PaginaMontada;

  beforeEach(() => {
    ligarRelogioControlado();
    pagina = montarPagina([APROVAR]);
  });

  afterEach(() => {
    pagina.encerrar();
    vi.useRealTimers();
  });

  it('a busca espera a pessoa parar de digitar e vai à URL', async () => {
    const tela = await abrirAbaDeDecisoes(
      pagina,
      '?aba=decisoes',
      [decisaoDoFato, decisaoDoTipo],
      {},
    );
    const campo = tela.querySelector<HTMLInputElement>('input[type="search"]') as HTMLInputElement;

    campo.value = 'ren';
    campo.dispatchEvent(new Event('input'));
    campo.value = 'renda';
    campo.dispatchEvent(new Event('input'));
    await passarOTempo(ESPERA_DA_BUSCA_MS - 1);
    expect(pagina.controller.match((r) => r.url === DECISOES)).toHaveLength(0);

    await passarOTempo(1);
    await pagina.assentar();
    pagina.controller
      .expectOne((r) => r.url === DECISOES && r.params.get('busca') === 'renda')
      .flush([decisaoDoFato]);
    await pagina.assentar();
    expect(TestBed.inject(Router).url).toBe('/?aba=decisoes&busca=renda');
  });
});
