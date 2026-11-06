import { TestBed } from '@angular/core/testing';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PesoAreaEnemDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AREAS,
  ERRO_500,
  GRUPOS,
  RES_805,
  digitarNumeroInvalidoESair,
  linhas750,
  linhas805,
  problem,
  PaginaDeTeste,
} from './pesos-enem.testing';

describe('PesosEnemPage — lista de grupos', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());

  it('PesosEnemPage_FalhaRepetidaDosGrupos_AnunciaNoAlertaDosGrupos', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), ERRO_500);
    t.expectListagem().flush([]);
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-grupos-tentar')?.click();
    await t.propagate();
    t.expectGrupos().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), ERRO_500);
    await t.propagate();
    t.fixture.detectChanges();

    expect(
      raiz.querySelector('#cfg-pesos-enem-grupos-tentar')?.closest('ui-alert')?.textContent,
    ).toContain('Tentativa 2 sem sucesso.');
  });

  it('PesosEnemPage_ListaDeGruposVazia_TrataComoFalhaDeCarregamento', async () => {
    await t.carregarUmaPagina([], AREAS, []);

    expect(t.store.catalogoGrupos.falhou()).toBe(true);
    const raiz = t.fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('ui-empty-state')).toBeNull();
    expect(raiz.querySelector('.list-state__retry button')).not.toBeNull();
    t.criacao.abrir();
    expect(t.criacao.aberto()).toBe(false);
  });

  it('PesosEnemPage_ErroAoCarregarGrupos_MostraAsLinhasEBloqueiaSoOCadastroAteONovoCarregamento', async () => {
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

    const raiz = t.fixture.nativeElement as HTMLElement;
    // Só os grupos falharam: o título não diz que as áreas também.
    expect(raiz.textContent).toContain('Não foi possível carregar os grupos de área do ENEM');
    expect(raiz.textContent).not.toContain('as áreas e os grupos');
    // As linhas trazem o rótulo do grupo: a tabela continua, na ordem da API. Só o
    // cadastro, que monta um grupo por item da lista, fica bloqueado.
    expect(
      Array.from(raiz.querySelectorAll('.cell-label--group-label'), (el) => el.textContent?.trim()),
    ).toEqual(linhas805.map((l) => l.grupoCurso.rotulo));
    expect(raiz.querySelector('ui-empty-state')).toBeNull();
    const cadastrar = Array.from(raiz.querySelectorAll<HTMLButtonElement>('button')).filter(
      (botao) => botao.textContent?.trim() === 'Cadastrar nova resolução',
    );
    expect(cadastrar.length).toBeGreaterThan(0);
    expect(cadastrar.every((botao) => botao.getAttribute('aria-disabled') === 'true')).toBe(true);
    t.criacao.abrir();
    expect(t.criacao.aberto()).toBe(false);

    // A edição em linha funciona: ela usa as linhas e as áreas, não a lista de grupos.
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.fixture.detectChanges();
    expect(t.edicao.form()?.controls.map((g) => g.controls.grupoCurso.value.codigo)).toEqual(
      linhas805.map((l) => l.grupoCurso.codigo),
    );
    t.edicao.cancelar();
    await t.propagate();
    t.fixture.detectChanges();

    raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-grupos-tentar')?.click();
    await t.propagate();
    // Só a lista que falhou é pedida de novo: as áreas já tinham chegado.
    t.expectGrupos().flush([...GRUPOS]);
    await t.propagate();
    t.fixture.detectChanges();

    expect(t.store.catalogoGrupos.falhou()).toBe(false);
    expect(raiz.querySelectorAll('.cell-label--group-label')).toHaveLength(4);
    t.criacao.abrir();
    expect(t.criacao.aberto()).toBe(true);
  });

  it('PesosEnemPage_TentarDeNovoOsGrupos_NaoDesmontaAEdicaoEmLinhaNemApagaOCorteDigitado', async () => {
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

    // Edição em linha aberta, com texto inválido num corte e o operador fora do campo.
    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.fixture.detectChanges();
    const corte = t.inputDaEdicao('corte', 0, 0);
    digitarNumeroInvalidoESair(corte);
    t.fixture.detectChanges();
    const raiz = t.fixture.nativeElement as HTMLElement;
    const erroDoCorte = (): string | undefined =>
      raiz.querySelector(`[id="${corte.id}-erro"]`)?.textContent?.trim();
    expect(erroDoCorte()).toBe('Número inválido.');

    raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-grupos-tentar')?.click();
    await t.propagate();
    t.fixture.detectChanges();

    // Antes de a tentativa responder: linhas, edição e erro continuam na tela.
    const grupos = t.expectGrupos();
    expect(raiz.querySelectorAll('.cell-label--group-label')).toHaveLength(linhas805.length);
    expect(raiz.querySelector('#grid-pe-bar')).not.toBeNull();
    expect(raiz.querySelector(`[id="${corte.id}"]`)).toBe(corte);
    expect(erroDoCorte()).toBe('Número inválido.');

    grupos.flush([...GRUPOS]);
    await t.propagate();
    t.fixture.detectChanges();

    // Depois: o erro continua, e Salvar não envia o corte apagado.
    expect(raiz.querySelector(`[id="${corte.id}"]`)).toBe(corte);
    expect(erroDoCorte()).toBe('Número inválido.');
    t.edicao.salvar();
    await t.propagate();
    t.controller.expectNone((r) => r.method === 'PUT');
  });

  it('PesosEnemPage_GruposChegamComEdicaoAberta_OrdemCongeladaAteFecharAEdicao', async () => {
    const ordemDaApi = (linhas: readonly PesoAreaEnemDto[]): PesoAreaEnemDto[] =>
      [linhas[3], linhas[0], linhas[1], linhas[2]].filter(
        (l): l is PesoAreaEnemDto => l !== undefined,
      );
    t.fixture.detectChanges();
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush(problem(503, 'uniplus.internal.unexpected', 'Serviço indisponível'), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/problem+json' },
    });
    t.expectListagem().flush([...ordemDaApi(linhas805), ...ordemDaApi(linhas750)]);
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    const rotulos = (): (string | undefined)[] =>
      Array.from(raiz.querySelectorAll('.cell-label--group-label'), (el) => el.textContent?.trim());
    const naOrdemDaApi = ordemDaApi(linhas805).map((l) => l.grupoCurso.rotulo);

    t.edicao.pedirEdicao(RES_805);
    await t.propagate();
    t.fixture.detectChanges();
    // Edição (Res. 805) e leitura (Res. 750) na ordem da API.
    expect(rotulos()).toEqual([...naOrdemDaApi, ...naOrdemDaApi]);

    // Os grupos chegam no meio da edição: nada se reordena, nem a edição nem a leitura.
    raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-grupos-tentar')?.click();
    await t.propagate();
    t.expectGrupos().flush([...GRUPOS]);
    await t.propagate();
    t.fixture.detectChanges();
    expect(rotulos()).toEqual([...naOrdemDaApi, ...naOrdemDaApi]);

    // Fechada a edição, a ordem dos grupos vale para todas as resoluções.
    t.edicao.cancelar();
    await t.propagate();
    t.fixture.detectChanges();
    const naOrdemDosGrupos = GRUPOS.map((grupo) => grupo.rotulo);
    expect(rotulos()).toEqual([...naOrdemDosGrupos, ...naOrdemDosGrupos]);
  });

  it('PesosEnemPage_FalhaDeServidorNosGrupos_AvisaComTraceIdEMostraOMotivo', async () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    t.fixture.detectChanges();
    const indisponivel = JSON.parse(
      problem(503, 'uniplus.internal.unexpected', 'Serviço indisponível'),
    ) as Parameters<ProblemI18nService['resolve']>[0];
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush(JSON.stringify(indisponivel), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/problem+json' },
    });
    t.expectListagem().flush([]);
    await t.propagate();
    t.fixture.detectChanges();

    expect(erroSpy).toHaveBeenCalledTimes(1);
    expect(erroSpy.mock.calls[0]?.[0]).toMatchObject({ status: 503, traceId: 'test-trace' });
    const titulo = TestBed.inject(ProblemI18nService).resolve(indisponivel).title;
    expect((t.fixture.nativeElement as HTMLElement).textContent).toContain(titulo);
  });

  it('PesosEnemPage_GruposRecusadosPorPermissao_AlertaDizOMotivoSemAvisoDeServidor', async () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    t.fixture.detectChanges();
    const semPermissao = JSON.parse(
      problem(403, 'uniplus.auth.forbidden', 'Acesso negado'),
    ) as Parameters<ProblemI18nService['resolve']>[0];
    t.expectAreas().flush([...AREAS]);
    t.expectGrupos().flush(JSON.stringify(semPermissao), {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'content-type': 'application/problem+json' },
    });
    t.expectListagem().flush([]);
    await t.propagate();
    t.fixture.detectChanges();

    const titulo = TestBed.inject(ProblemI18nService).resolve(semPermissao).title;
    expect((t.fixture.nativeElement as HTMLElement).textContent).toContain(titulo);
    expect(erroSpy).not.toHaveBeenCalled();
  });
});
