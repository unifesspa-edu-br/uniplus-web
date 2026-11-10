import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { map, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  type EtapaDaVersao,
  type ItemDaFilaDeJanelasDto,
} from '@uniplus/shared-data/autorizacao';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { ok, recusa } from '../testes';
import { FilaDeJanelasPage } from './fila-de-janelas.page';

const ENVIADO: ItemDaFilaDeJanelasDto = {
  perfilId: 'p1',
  perfilNome: 'Acompanhamento',
  versaoAlvo: 3,
  prazo: '2026-11-12T15:00:00Z',
  loteEnviado: true,
  quantidadeADecidir: 1,
};
const PENDENTE: ItemDaFilaDeJanelasDto = {
  perfilId: 'p2',
  perfilNome: 'Auditoria',
  versaoAlvo: 5,
  prazo: '2026-11-13T02:30:00Z',
  loteEnviado: false,
  quantidadeADecidir: 4,
};

describe('FilaDeJanelasPage', () => {
  const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };
  const leitura = vi.fn();

  const assentar = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    await new Promise((resolver) => setTimeout(resolver));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function abrir(etapa: EtapaDaVersao, fila: unknown = ok([ENVIADO, PENDENTE])) {
    leitura.mockReturnValue(of(fila));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideMensagensDeAcesso(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        provideHttpClient(
          withInterceptors([
            (req) =>
              leitura(req.url, req.params.get('etapa')).pipe(
                map((body: unknown) => new HttpResponse({ body })),
              ),
          ]),
        ),
        { provide: NotificationService, useValue: notificacoes },
      ],
    });
    const fixture = TestBed.createComponent(FilaDeJanelasPage);
    fixture.componentRef.setInput('etapa', etapa);
    await assentar(fixture);
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  const secao = (host: HTMLElement, perfil: string): HTMLElement => {
    const achada = [...host.querySelectorAll<HTMLElement>('section.panel')].find((s) =>
      s.textContent?.includes(perfil),
    );
    if (!achada) throw new Error('seção ausente');
    return achada;
  };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  it.each([
    ['gestao_de_acessos', 'Janelas de migração na gestão de acessos'],
    ['protecao_de_dados', 'Janelas de migração na proteção de dados'],
  ] as const)('a etapa %s lê a própria fila e tem o próprio título', async (etapa, titulo) => {
    const { host } = await abrir(etapa);

    expect(leitura).toHaveBeenCalledWith(
      'http://api.test/api/autorizacao/janelas-de-migracao',
      etapa,
    );
    expect(host.querySelector('h1')?.textContent).toContain(titulo);
  });

  it('mostra de cada janela o perfil, a versão-alvo, o prazo em Brasília e as concessões a decidir', async () => {
    const { host } = await abrir('gestao_de_acessos');

    const enviado = secao(host, 'Acompanhamento');
    expect(enviado.textContent).toContain('versão 3');
    expect(enviado.textContent).toContain('12/11/2026, 12:00');
    expect(enviado.textContent).toContain('1 concessão');
    expect(enviado.textContent).not.toContain('1 concessões');
    const pendente = secao(host, 'Auditoria');
    expect(pendente.textContent).toContain('12/11/2026, 23:30');
    expect(pendente.textContent).toContain('4 concessões');
  });

  it('lista as janelas numa lista com um item por janela, cada um com seu título e link', async () => {
    const { host } = await abrir('gestao_de_acessos');

    const lista = host.querySelector('ul');
    expect(lista?.getAttribute('aria-label')).toBe('Janelas de migração na gestão de acessos');
    const itens = [...(lista?.querySelectorAll(':scope > li') ?? [])];
    expect(itens).toHaveLength(2);
    expect(itens.map((li) => li.querySelector('h2 a')?.textContent?.trim())).toEqual([
      'Acompanhamento',
      'Auditoria',
    ]);
  });

  it('com a fila vazia, não mostra lista', async () => {
    const { host } = await abrir('gestao_de_acessos', ok([]));

    expect(host.querySelector('ul')).toBeNull();
  });

  it('diz se o lote já foi enviado', async () => {
    const { host } = await abrir('gestao_de_acessos');

    expect(secao(host, 'Acompanhamento').textContent).toContain('Lote enviado');
    expect(secao(host, 'Auditoria').textContent).toContain('Lote ainda não enviado');
  });

  it('leva cada janela à tela da janela do perfil', async () => {
    const { host } = await abrir('protecao_de_dados');

    expect(secao(host, 'Auditoria').querySelector('a')?.getAttribute('href')).toBe(
      '/acessos/perfis/p2/janela',
    );
  });

  it('não traz dado pessoal de beneficiário', async () => {
    const { host } = await abrir('gestao_de_acessos');

    expect(host.textContent).not.toMatch(/\d{3}\.\d{3}\.\d{3}|@/);
  });

  it('diz que a fila está vazia', async () => {
    const { host } = await abrir('gestao_de_acessos', ok([]));

    expect(host.textContent).toContain('Nenhuma janela de migração aguarda a sua decisão.');
    expect(host.querySelectorAll('section.panel')).toHaveLength(0);
  });

  it('com a leitura falha, não diz que a fila está vazia e oferece tentar novamente', async () => {
    const { fixture, host } = await abrir(
      'gestao_de_acessos',
      recusa('uniplus.internal.unexpected', 500, 'Erro interno'),
    );
    const tentar = (): HTMLButtonElement | undefined =>
      [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Tentar novamente');

    expect(host.textContent).not.toContain('Nenhuma janela de migração aguarda');
    leitura.mockReturnValue(of(ok([ENVIADO])));
    tentar()?.click();
    await assentar(fixture);

    expect(host.querySelectorAll('section.panel')).toHaveLength(1);
  });

  it('sem permissão para a fila, mostra a recusa sem oferecer nova tentativa', async () => {
    const { host } = await abrir('gestao_de_acessos', recusa('uniplus.forbidden', 403));

    expect(
      [...host.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Tentar novamente'),
    ).toBe(false);
    expect(host.querySelectorAll('section.panel')).toHaveLength(0);
  });
});
