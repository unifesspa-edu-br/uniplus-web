import { TestBed } from '@angular/core/testing';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PesosEnemApi } from '@uniplus/shared-data/configuracao';
import { throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AREAS, ERRO_500, GRUPOS, PaginaDeTeste, problem } from './pesos-enem.testing';

describe('PesosEnemPage — lista de áreas', () => {
  let t: PaginaDeTeste;

  beforeEach(() => {
    t = new PaginaDeTeste();
  });

  afterEach(() => t.verificar());

  it('PesosEnemPage_FalhaRepetidaDasAreas_AnunciaNoAlertaDasAreas', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), ERRO_500);
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush([]);
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-areas-tentar')?.click();
    await t.propagate();
    t.expectAreas().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), ERRO_500);
    await t.propagate();
    t.fixture.detectChanges();

    expect(
      raiz.querySelector('#cfg-pesos-enem-areas-tentar')?.closest('ui-alert')?.textContent,
    ).toContain('Tentativa 2 sem sucesso.');
  });

  it('PesosEnemPage_AreasRecusadasSemTitulo_AlertaComTextoPadrao', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush(problem(500, 'uniplus.teste.sem_titulo', '   '), ERRO_500);
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush([]);
    await t.propagate();
    t.fixture.detectChanges();

    expect(
      (t.fixture.nativeElement as HTMLElement)
        .querySelector('#cfg-pesos-enem-areas-tentar')
        ?.closest('ui-alert')?.textContent,
    ).toContain('A lista de áreas do ENEM não foi carregada.');
  });

  it('PesosEnemPage_ErroAoCarregarAreas_ExibeAlertaEBloqueiaCadastro', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/problem+json' },
    });
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush([]);
    await t.propagate();
    t.fixture.detectChanges();

    expect(t.store.listaAreas.falhou()).toBe(true);
    t.criacao.abrir();
    expect(t.criacao.aberto()).toBe(false);

    const retry = t.fixture.nativeElement.querySelector(
      '.list-state__retry button',
    ) as HTMLButtonElement | null;
    expect(retry).not.toBeNull();
    retry?.click();
    await t.propagate();
    t.expectAreas().flush([...AREAS]);
    await t.propagate();

    expect(t.store.listaAreas.falhou()).toBe(false);
    t.criacao.abrir();
    expect(t.criacao.aberto()).toBe(true);
  });

  it('PesosEnemPage_ListaDeAreasVazia_TrataComoFalhaDeCarregamento', async () => {
    await t.carregarUmaPagina([], []);

    expect(t.store.listaAreas.falhou()).toBe(true);
    const raiz = t.fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('ui-empty-state')).toBeNull();
    expect(raiz.querySelector('.list-state__retry button')).not.toBeNull();
  });

  it('PesosEnemPage_TentarDeNovoAsAreas_MantemOFocoEmPontoEstavel', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/problem+json' },
    });
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush([]);
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    const botao = raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-areas-tentar');
    if (!botao) throw new Error('botão de tentar de novo ausente');
    botao.focus();
    botao.click();
    await t.propagate();
    t.fixture.detectChanges();

    // Enquanto recarrega, o botão continua na tela e com o foco.
    expect(document.activeElement?.id).toBe('cfg-pesos-enem-areas-tentar');
    expect(raiz.querySelector('#cfg-pesos-enem-areas-tentar')?.getAttribute('aria-disabled')).toBe(
      'true',
    );

    // Carregou: o alerta sai, e o foco vai ao título da página, não ao body.
    t.expectAreas().flush([...AREAS]);
    await t.propagate();
    t.fixture.detectChanges();
    await t.propagate();
    expect(raiz.querySelector('#cfg-pesos-enem-areas-tentar')).toBeNull();
    expect(document.activeElement?.id).toBe('cfg-pesos-enem-titulo');
  });

  it('PesosEnemPage_FalhaDeServidorNasAreas_AvisaComTraceIdEMostraOMotivo', async () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    t.fixture.detectChanges();
    const indisponivel = JSON.parse(
      problem(503, 'uniplus.internal.unexpected', 'Serviço indisponível'),
    ) as Parameters<ProblemI18nService['resolve']>[0];
    t.expectAreas().flush(JSON.stringify(indisponivel), {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'content-type': 'application/problem+json' },
    });
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush([]);
    await t.propagate();
    t.fixture.detectChanges();

    // O aviso de erro de servidor leva o problema (com o traceId) para o suporte.
    expect(erroSpy).toHaveBeenCalledTimes(1);
    expect(erroSpy.mock.calls[0]?.[0]).toMatchObject({ status: 503, traceId: 'test-trace' });
    const titulo = TestBed.inject(ProblemI18nService).resolve(indisponivel).title;
    expect(t.store.mensagemFalhaAreas()).toBe(titulo);
    expect((t.fixture.nativeElement as HTMLElement).textContent).toContain(titulo);
  });

  it('PesosEnemPage_AreasRecusadasPorPermissao_AlertaDizOMotivoSemAvisoDeServidor', async () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    t.fixture.detectChanges();
    const semPermissao = JSON.parse(
      problem(403, 'uniplus.auth.forbidden', 'Acesso negado'),
    ) as Parameters<ProblemI18nService['resolve']>[0];
    t.expectAreas().flush(JSON.stringify(semPermissao), {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'content-type': 'application/problem+json' },
    });
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush([]);
    await t.propagate();
    t.fixture.detectChanges();

    const titulo = TestBed.inject(ProblemI18nService).resolve(semPermissao).title;
    expect(titulo).not.toBe('A lista de áreas do ENEM não foi carregada.');
    expect((t.fixture.nativeElement as HTMLElement).textContent).toContain(titulo);
    expect(erroSpy).not.toHaveBeenCalled();
  });

  it('PesosEnemPage_ErroForaDoEnvelopeNasAreas_MantemAlertaENovaTentativa', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/problem+json' },
    });
    t.expectGrupos().flush([...GRUPOS]);
    t.expectListagem().flush([]);
    await t.propagate();
    t.fixture.detectChanges();

    // A nova tentativa falha fora do ApiResult (ex.: erro de outro interceptor).
    vi.spyOn(TestBed.inject(PesosEnemApi), 'listarAreas').mockReturnValueOnce(
      throwError(() => new Error('falha fora do envelope')),
    );
    const raiz = t.fixture.nativeElement as HTMLElement;
    raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-areas-tentar')?.click();
    await t.propagate();
    t.fixture.detectChanges();

    // A carga não fica presa: o alerta continua, com o botão de tentar de novo habilitado.
    expect(t.store.listaAreas.pendente()).toBe(false);
    expect(t.store.listaAreas.falhou()).toBe(true);
    expect(raiz.textContent).toContain('A lista de áreas do ENEM não foi carregada.');
    const botao = raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-areas-tentar');
    expect(botao?.getAttribute('aria-disabled')).toBeNull();

    botao?.click();
    await t.propagate();
    t.expectAreas().flush([...AREAS]);
    await t.propagate();
    t.fixture.detectChanges();
    expect(t.store.listaAreas.falhou()).toBe(false);
    expect(t.store.podeCadastrar()).toBe(true);
  });

  it('PesosEnemPage_AreasFalhamComGruposPendentes_TentarDeNovoRecarregaAsAreas', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/problem+json' },
    });
    // Os grupos ainda não responderam.
    const grupos = t.expectGrupos();
    t.expectListagem().flush([]);
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    const botao = raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-areas-tentar');
    // Nada está recarregando as áreas: o botão continua acionável.
    expect(botao?.getAttribute('aria-disabled')).toBeNull();
    botao?.click();
    await t.propagate();

    t.expectAreas().flush([...AREAS]);
    grupos.flush([...GRUPOS]);
    await t.propagate();
    expect(t.store.listaAreas.falhou()).toBe(false);
  });

  it('PesosEnemPage_TentarDeNovoAsAreasComGruposPendentes_FocoNaoEsperaOsGrupos', async () => {
    t.fixture.detectChanges();
    t.expectAreas().flush(problem(500, 'uniplus.internal.unexpected', 'Erro interno'), {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'application/problem+json' },
    });
    // Os grupos ainda não responderam, e vão demorar.
    const grupos = t.expectGrupos();
    t.expectListagem().flush([]);
    await t.propagate();
    t.fixture.detectChanges();

    const raiz = t.fixture.nativeElement as HTMLElement;
    const botao = raiz.querySelector<HTMLButtonElement>('#cfg-pesos-enem-areas-tentar');
    if (!botao) throw new Error('botão de tentar de novo ausente');
    botao.focus();
    botao.click();
    await t.propagate();
    t.fixture.detectChanges();

    // As áreas chegam: o alerta sai, e o foco vai ao título sem esperar os grupos.
    t.expectAreas().flush([...AREAS]);
    await t.propagate();
    t.fixture.detectChanges();
    await t.propagate();
    expect(raiz.querySelector('#cfg-pesos-enem-areas-tentar')).toBeNull();
    expect(document.activeElement?.id).toBe('cfg-pesos-enem-titulo');

    grupos.flush([...GRUPOS]);
    await t.propagate();
  });
});
