import {
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, map, of, throwError, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  TermosDeResponsabilidadeApi,
} from '@uniplus/shared-data/autorizacao';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { ok, recusa, recusaPeloInterceptor, versaoDoTermo } from '../testes';
import { PublicacaoDoTermoPage } from './publicacao-do-termo.page';

const V1 = versaoDoTermo({ id: 'termo-v1', numero: 1, vigente: false, ato: 'Portaria 3/2026' });
const V2 = versaoDoTermo();
const TEXTO_NOVO = 'Declaro ciência das obrigações de sigilo e de finalidade. '.repeat(5);

const api = { publicar: vi.fn() };

/** O registro de acesso não gravou: a API não entrega o termo, e a leitura pode ser repetida. */
const falhaDoServidor = () =>
  new HttpErrorResponse({
    status: 503,
    statusText: 'Erro',
    error: {
      type: 'x',
      title: 'Não foi possível registrar o acesso aos dados.',
      status: 503,
      code: 'uniplus.autorizacao.registro_de_acesso.falha_ao_gravar',
    },
  });
const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };
const leituras = vi.fn<(url: string) => Observable<unknown>>();

function responderLeituras(vigente: unknown, historico: unknown = ok([V1, V2])): void {
  leituras.mockImplementation((url) => of(url.includes('/vigente') ? vigente : historico));
}

/** Espera as leituras e a renderização assentarem. */
async function assentar(): Promise<void> {
  const app = TestBed.inject(ApplicationRef);
  await app.whenStable();
  app.tick();
}

async function abrir(): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideMensagensDeAcesso(),
      { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
      provideHttpClient(
        withInterceptors([
          (req) =>
            leituras(req.urlWithParams).pipe(
              map((body) => (body instanceof HttpResponse ? body : new HttpResponse({ body }))),
            ),
        ]),
      ),
      { provide: TermosDeResponsabilidadeApi, useValue: api },
      { provide: NotificationService, useValue: notificacoes },
    ],
  });
  const fixture = TestBed.createComponent(PublicacaoDoTermoPage);
  const host = fixture.nativeElement as HTMLElement;
  document.body.appendChild(host);
  fixture.detectChanges();
  await assentar();
  return host;
}

function preencher(host: HTMLElement, texto: string, ato: string): void {
  const campoTexto = host.querySelector<HTMLTextAreaElement>('textarea');
  const campoAto = host.querySelector<HTMLInputElement>('input[formcontrolname="ato"]');
  if (campoTexto === null || campoAto === null) throw new Error('formulário ausente');
  campoTexto.value = texto;
  campoTexto.dispatchEvent(new Event('input'));
  campoAto.value = ato;
  campoAto.dispatchEvent(new Event('input'));
}

async function publicar(host: HTMLElement): Promise<void> {
  host.querySelector('form')?.dispatchEvent(new Event('submit'));
  await assentar();
}

describe('PublicacaoDoTermoPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mostra a vigente com o texto e o histórico da versão 1 à mais recente, destacando a vigente', async () => {
    responderLeituras(ok(V2));
    const host = await abrir();

    expect(host.querySelector('cfg-termo-de-responsabilidade')?.textContent).toContain(
      'Versão vigente',
    );
    const linhas = [...host.querySelectorAll<HTMLElement>('tr[data-versao]')];
    expect(linhas.map((l) => l.dataset['versao'])).toEqual(['1', '2']);
    expect(linhas[1]?.textContent).toContain('Vigente');
    expect(linhas[0]?.textContent).toContain('Substituída');
  });

  it('sem versão publicada, diz isso e publica a primeira sem vigente esperada', async () => {
    responderLeituras(
      recusaPeloInterceptor('uniplus.autorizacao.termo.sem_versao_vigente', 404, 'x'),
      ok([]),
    );
    api.publicar.mockReturnValue(of(ok(versaoDoTermo({ numero: 1 }))));
    const host = await abrir();

    expect(host.textContent).toContain('Nenhuma versão publicada');
    expect(host.textContent).not.toContain('Não foi possível carregar o termo');
    preencher(host, TEXTO_NOVO, 'Portaria 1/2026');
    await publicar(host);

    expect(api.publicar.mock.calls[0]?.[0]).toEqual({
      texto: TEXTO_NOVO,
      ato: 'Portaria 1/2026',
      versaoVigenteEsperadaId: null,
    });
  });

  it('publica sobre a vigente lida, avisa e relê', async () => {
    responderLeituras(ok(V2));
    api.publicar.mockReturnValue(of(ok(versaoDoTermo({ id: 'termo-v3', numero: 3 }))));
    const host = await abrir();
    const leiturasAntes = leituras.mock.calls.length;

    preencher(host, TEXTO_NOVO, ' Portaria 20/2026 ');
    await publicar(host);

    expect(api.publicar.mock.calls[0]?.[0]).toMatchObject({
      ato: 'Portaria 20/2026',
      versaoVigenteEsperadaId: 'termo-v2',
    });
    expect(notificacoes.success).toHaveBeenCalledWith('Versão 3 do termo publicada');
    expect(leituras.mock.calls.length).toBeGreaterThan(leiturasAntes);
  });

  it('não publica texto curto nem sem ato', async () => {
    responderLeituras(ok(V2));
    const host = await abrir();

    preencher(host, 'Curto demais.', '');
    await publicar(host);

    expect(api.publicar).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Informe ao menos 200 caracteres.');
    expect(host.textContent).toContain('Campo obrigatório.');
  });

  it('com outra versão publicada antes (409), relê e avisa', async () => {
    responderLeituras(ok(V2));
    api.publicar.mockReturnValue(
      of(recusa('uniplus.autorizacao.termo.vigente_alterado', 409, 'x')),
    );
    const host = await abrir();
    const leiturasAntes = leituras.mock.calls.length;

    preencher(host, TEXTO_NOVO, 'Portaria 20/2026');
    await publicar(host);

    expect(host.querySelector('[aria-live="polite"]')?.textContent).toContain(
      'Confira a versão vigente antes de publicar outra.',
    );
    expect(leituras.mock.calls.length).toBeGreaterThan(leiturasAntes);
  });

  it('a recusa de um campo (422) fica no campo', async () => {
    responderLeituras(ok(V2));
    api.publicar.mockReturnValue(
      of(recusa('uniplus.autorizacao.termo.texto_igual_ao_vigente', 422, 'x')),
    );
    const host = await abrir();

    preencher(host, TEXTO_NOVO, 'Portaria 20/2026');
    await publicar(host);

    const texto = host.querySelector('textarea');
    expect(texto?.getAttribute('aria-invalid')).toBe('true');
    expect(host.querySelector('#cfg-termo-texto-erro')?.textContent).toContain(
      'O texto é igual ao da versão vigente.',
    );
  });

  it('com o registro de acesso fora do ar (503), mostra a falha sem termo e lê de novo', async () => {
    let vez = 0;
    leituras.mockImplementation((url) => {
      if (!url.includes('/vigente')) return of(ok([V1, V2]));
      return vez++ === 0 ? throwError(() => falhaDoServidor()) : of(ok(V2));
    });
    const host = await abrir();

    expect(host.textContent).toContain('Não foi possível carregar o termo');
    expect(host.querySelector('cfg-termo-de-responsabilidade')).toBeNull();
    const repetir = [...host.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Tentar novamente',
    );
    repetir?.click();
    await assentar();

    expect(host.querySelector('cfg-termo-de-responsabilidade')?.textContent).toContain(
      'Versão vigente',
    );
    expect(host.textContent).not.toContain('Tentar novamente');
  });

  it('o histórico segue pelo cursor, e a publicação o relê desde a primeira página', async () => {
    const comProxima = new HttpResponse({
      body: ok([V1]),
      headers: new HttpHeaders({ Link: '</api/x?cursor=PROX&direction=next>; rel="next"' }),
    });
    leituras.mockImplementation((url) =>
      of(url.includes('/vigente') ? ok(V2) : url.includes('cursor=') ? ok([V2]) : comProxima),
    );
    api.publicar.mockReturnValue(of(ok(versaoDoTermo({ id: 'termo-v3', numero: 3 }))));
    const host = await abrir();

    [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Próximo'))?.click();
    await assentar();
    expect(leituras.mock.lastCall?.[0]).toContain('cursor=PROX');
    expect(host.querySelectorAll('tr[data-versao]')).toHaveLength(1);

    preencher(host, TEXTO_NOVO, 'Portaria 20/2026');
    await publicar(host);
    const doHistorico = leituras.mock.calls
      .map(([url]) => url)
      .filter((u) => u.includes('/versoes'));
    expect(doHistorico.at(-1)).not.toContain('cursor=');
  });

  const avisoDaPublicacao = (host: HTMLElement) =>
    host.querySelector('[aria-live="polite"]')?.textContent ?? '';
  const botaoPublicar = (host: HTMLElement) =>
    host.querySelector<HTMLButtonElement>('button[type="submit"]');

  it('com a leitura da vigente em andamento ou falha, não publica', async () => {
    leituras.mockImplementation((url) =>
      url.includes('/vigente') ? throwError(() => falhaDoServidor()) : of(ok([V1, V2])),
    );
    const host = await abrir();

    preencher(host, TEXTO_NOVO, 'Portaria 20/2026');
    await publicar(host);

    expect(botaoPublicar(host)?.getAttribute('aria-disabled')).toBe('true');
    expect(api.publicar).not.toHaveBeenCalled();
  });

  it('depois de outra versão publicada antes (409), espera a releitura da vigente para publicar', async () => {
    const releitura = new Subject<unknown>();
    let vez = 0;
    leituras.mockImplementation((url) => {
      if (!url.includes('/vigente')) return of(ok([V1, V2]));
      return vez++ === 0 ? of(ok(V2)) : releitura;
    });
    api.publicar.mockReturnValueOnce(
      of(recusa('uniplus.autorizacao.termo.vigente_alterado', 409, 'x')),
    );
    const host = await abrir();
    preencher(host, TEXTO_NOVO, 'Portaria 20/2026');
    host.querySelector('form')?.dispatchEvent(new Event('submit'));
    await vi.waitFor(() => expect(api.publicar).toHaveBeenCalledTimes(1));
    TestBed.inject(ApplicationRef).tick();

    host.querySelector('form')?.dispatchEvent(new Event('submit'));
    await Promise.resolve();
    expect(api.publicar).toHaveBeenCalledTimes(1);
    expect(botaoPublicar(host)?.getAttribute('aria-disabled')).toBe('true');
    expect(avisoDaPublicacao(host)).not.toContain('Confira a versão vigente');
    releitura.next(ok(versaoDoTermo({ id: 'termo-v3', numero: 3 })));
    releitura.complete();
    await assentar();

    expect(botaoPublicar(host)?.getAttribute('aria-disabled')).toBeNull();
    expect(avisoDaPublicacao(host)).toContain('Confira a versão vigente');
  });

  it('depois de outra versão publicada antes (409), com a releitura falha, mostra o erro e só avisa na retentativa', async () => {
    let vez = 0;
    leituras.mockImplementation((url) => {
      if (!url.includes('/vigente')) return of(ok([V1, V2]));
      vez++;
      return vez === 2 ? throwError(() => falhaDoServidor()) : of(ok(V2));
    });
    api.publicar.mockReturnValueOnce(
      of(recusa('uniplus.autorizacao.termo.vigente_alterado', 409, 'x')),
    );
    const host = await abrir();
    preencher(host, TEXTO_NOVO, 'Portaria 20/2026');
    await publicar(host);

    expect(avisoDaPublicacao(host)).not.toContain('Confira a versão vigente');
    const repetir = [...host.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Tentar novamente',
    );
    expect(repetir).toBeDefined();
    repetir?.click();
    await assentar();

    expect(avisoDaPublicacao(host)).toContain('Confira a versão vigente');
  });
});
