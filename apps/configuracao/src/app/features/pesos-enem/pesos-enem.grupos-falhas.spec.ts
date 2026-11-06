import { TestBed } from '@angular/core/testing';

import { PesoAreaEnemDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CatalogoGruposAreaEnem } from '../../shared/grupos-area-enem';
import { AREAS, GRUPOS, RES_805, linhas805, problem, PaginaDeTeste } from './pesos-enem.testing';

describe('PesosEnemPage — falhas e recargas das listas', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());
  it('PesosEnemPage_GruposFalhamComAreasPendentesEOperadorTentaDeNovo_TabelaEEdicaoNaoSomem', async () => {
    t.fixture.detectChanges();
    const areas = t.expectAreas();
    // Os grupos falham enquanto as áreas ainda carregam.
    t.expectGrupos().flush(problem(503, 'uniplus.internal.unexpected', 'Serviço indisponível'), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/problem+json' },
    });
    t.expectListagem().flush([...linhas805]);
    await t.propagate();
    t.fixture.detectChanges();
    const raiz = t.fixture.nativeElement as HTMLElement;

    // O operador tenta de novo os grupos, e as áreas chegam com a tentativa ainda em curso.
    raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-grupos-tentar')?.click();
    await t.propagate();
    const grupos = t.expectGrupos();
    areas.flush([...AREAS]);
    await t.propagate();
    t.fixture.detectChanges();
    expect(raiz.querySelectorAll('.cell-label--group-label')).toHaveLength(linhas805.length);

    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.fixture.detectChanges();
    expect(raiz.querySelector('#grid-pe-bar')).not.toBeNull();

    grupos.flush([...GRUPOS]);
    await t.propagate();
    t.fixture.detectChanges();
    expect(raiz.querySelector('#grid-pe-bar')).not.toBeNull();
  });

  it('PesosEnemPage_RecargaAutomaticaDosGruposComEdicaoAberta_NaoEscondeATabela', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush(problem(503, 'uniplus.internal.unexpected', 'Serviço indisponível'), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/problem+json' },
    });
    t.expectListagem().flush([...linhas805]);
    await t.propagate();
    t.fixture.detectChanges();
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.fixture.detectChanges();
    const raiz = t.fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('#grid-pe-bar')).not.toBeNull();

    // Uma recarga automática dos grupos (não o "Tentar novamente") começa com a edição aberta.
    TestBed.inject(CatalogoGruposAreaEnem).recarregar();
    await t.propagate();
    t.fixture.detectChanges();
    const recarga = t.expectGrupos();
    expect(raiz.querySelector('#grid-pe-bar')).not.toBeNull();
    expect(raiz.querySelectorAll('.cell-label--group-label')).toHaveLength(linhas805.length);

    recarga.flush([]);
    await t.propagate();
    t.fixture.detectChanges();
    expect(raiz.querySelector('#grid-pe-bar')).not.toBeNull();
  });

  it('PesosEnemPage_RecargaDosGruposVoltaVazia_SegueComAListaAnteriorECadastroLiberado', async () => {
    await t.carregarUmaPagina([...linhas805]);
    expect(t.store.podeCadastrar()).toBe(true);

    TestBed.inject(CatalogoGruposAreaEnem).recarregar();
    t.expectGrupos().flush([]);
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).not.toContain('Não foi possível carregar os grupos de área do ENEM');
    expect(t.store.podeCadastrar()).toBe(true);
    t.criacao.abrir();
    expect(t.criacao.form.controls.grupos.controls).toHaveLength(GRUPOS.length);
  });

  it('PesosEnemPage_ListaDeGruposVaziaComLinhas_MostraAsLinhasNaOrdemDaApi', async () => {
    const foraDeOrdem = [linhas805[2], linhas805[0], linhas805[3], linhas805[1]].filter(
      (l): l is PesoAreaEnemDto => l !== undefined,
    );
    await t.carregarUmaPagina(foraDeOrdem, AREAS, []);

    const raiz = t.fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).toContain('Não foi possível carregar os grupos de área do ENEM');
    // Sem a lista não há ordem dos grupos: as linhas seguem a ordem em que a API as devolveu.
    expect(
      Array.from(raiz.querySelectorAll('.cell-label--group-label'), (el) => el.textContent?.trim()),
    ).toEqual(foraDeOrdem.map((l) => l.grupoCurso.rotulo));
    expect(t.store.podeCadastrar()).toBe(false);
  });

  it('PesosEnemPage_FalhaDasDuasListas_UmAlertaEUmBotaoPorLista', async () => {
    t.fixture.detectChanges();
    const areas = t.expectAreas();
    const grupos = t.expectGrupos();
    t.expectListagem().flush([]);
    areas.flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/problem+json' },
    });
    grupos.flush(problem(503, 'uniplus.internal.unexpected', 'Serviço indisponível'), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/problem+json' },
    });
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).toContain('Não foi possível carregar as áreas do ENEM');
    expect(raiz.textContent).toContain('Não foi possível carregar os grupos de área do ENEM');
    const botaoAreas = raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-areas-tentar');
    const botaoGrupos = raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-grupos-tentar');
    expect(botaoAreas).not.toBeNull();
    expect(botaoGrupos).not.toBeNull();

    // Cada botão fica desabilitado só enquanto a própria lista carrega.
    botaoAreas?.click();
    await t.propagate();
    t.fixture.detectChanges();
    expect(botaoAreas?.getAttribute('aria-disabled')).toBe('true');
    expect(botaoGrupos?.getAttribute('aria-disabled')).toBeNull();

    botaoGrupos?.click();
    await t.propagate();
    t.fixture.detectChanges();
    expect(botaoGrupos?.getAttribute('aria-disabled')).toBe('true');

    t.expectAreas().flush([...AREAS]);
    await t.propagate();
    t.fixture.detectChanges();
    // As áreas chegaram: o alerta delas sai; o dos grupos segue, ainda carregando.
    expect(raiz.querySelector('#cfg-pesos-enem-areas-tentar')).toBeNull();
    expect(raiz.querySelector('#cfg-pesos-enem-grupos-tentar')?.getAttribute('aria-disabled')).toBe(
      'true',
    );

    t.expectGrupos().flush([...GRUPOS]);
    await t.propagate();
    t.fixture.detectChanges();
    expect(raiz.querySelector('#cfg-pesos-enem-grupos-tentar')).toBeNull();
  });

  it('PesosEnemPage_UmaListaFalhaDeNovoComAOutraPendente_NovoCliqueDelaRecarrega', async () => {
    t.fixture.detectChanges();
    const areas = t.expectAreas();
    const grupos = t.expectGrupos();
    t.expectListagem().flush([]);
    areas.flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/problem+json' },
    });
    grupos.flush(problem(503, 'uniplus.internal.unexpected', 'Serviço indisponível'), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/problem+json' },
    });
    await t.propagate();
    t.fixture.detectChanges();
    const raiz = t.fixture.nativeElement as HTMLElement;

    // O operador tenta de novo as duas listas.
    raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-areas-tentar')?.click();
    raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-grupos-tentar')?.click();
    await t.propagate();
    const areasDeNovo = t.expectAreas();
    // Os grupos falham de novo logo; as áreas continuam carregando.
    t.expectGrupos().flush(problem(503, 'uniplus.internal.unexpected', 'Serviço indisponível'), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/problem+json' },
    });
    await t.propagate();
    t.fixture.detectChanges();

    // O botão dos grupos está acionável, e o clique dele gera a requisição.
    const botaoGrupos = raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-grupos-tentar');
    expect(botaoGrupos?.getAttribute('aria-disabled')).toBeNull();
    botaoGrupos?.click();
    await t.propagate();
    t.expectGrupos().flush([...GRUPOS]);
    areasDeNovo.flush([...AREAS]);
    await t.propagate();
    expect(t.store.catalogoGrupos.falhou()).toBe(false);
    expect(t.store.listaAreas.falhou()).toBe(false);
  });

  it('PesosEnemPage_RecargaDosGruposEmSegundoPlano_NaoMexeNoFoco', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush(problem(503, 'uniplus.internal.unexpected', 'Serviço indisponível'), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/problem+json' },
    });
    t.expectListagem().flush([]);
    await t.propagate();
    t.fixture.detectChanges();
    (document.activeElement as HTMLElement | null)?.blur();

    // Outra tela pede o vocabulário de novo, e ele chega: o operador não acionou nada aqui.
    TestBed.inject(CatalogoGruposAreaEnem).garantirCarregado();
    t.expectGrupos().flush([...GRUPOS]);
    await t.propagate();
    t.fixture.detectChanges();
    await t.propagate();

    expect(t.store.catalogoGrupos.falhou()).toBe(false);
    expect(document.activeElement).toBe(document.body);
  });
});
