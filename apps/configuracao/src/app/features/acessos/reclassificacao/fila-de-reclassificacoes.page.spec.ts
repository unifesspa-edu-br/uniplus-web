import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { map, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  type EtapaDaVersao,
  type ItemDaFilaDeReclassificacoesDto,
} from '@uniplus/shared-data/autorizacao';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { ok, recusa } from '../testes';
import { FilaDeReclassificacoesPage } from './fila-de-reclassificacoes.page';

const MUDANCA = {
  classificacaoAnterior: 'interno',
  classificacaoNova: 'pessoal',
  deUnidadeAnterior: false,
  deUnidadeNovo: false,
};
const SUBIDA: ItemDaFilaDeReclassificacoesDto = {
  id: 'r1',
  perfilId: 'p1',
  perfilNome: 'Acompanhamento',
  codigo: 'selecao:processos:aprovar',
  mudanca: MUDANCA,
  instante: '2026-11-09T15:00:00Z',
  concessoesAguardando: 1,
};
const ESCOPO: ItemDaFilaDeReclassificacoesDto = {
  id: 'r2',
  perfilId: 'p2',
  perfilNome: 'Auditoria',
  codigo: 'selecao:processos:configurar',
  mudanca: { ...MUDANCA, classificacaoNova: 'interno', deUnidadeNovo: true },
  instante: '2026-11-10T02:30:00Z',
  concessoesAguardando: 4,
};

describe('FilaDeReclassificacoesPage', () => {
  const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };
  const leitura = vi.fn();

  const assentar = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    await new Promise((resolver) => setTimeout(resolver));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function abrir(etapa: EtapaDaVersao, fila: unknown = ok([SUBIDA, ESCOPO])) {
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
    const fixture = TestBed.createComponent(FilaDeReclassificacoesPage);
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
    ['gestao_de_acessos', 'Reclassificações na gestão de acessos'],
    ['protecao_de_dados', 'Reclassificações na proteção de dados'],
  ] as const)('a etapa %s lê a própria fila e tem o próprio título', async (etapa, titulo) => {
    const { host } = await abrir(etapa);

    expect(leitura).toHaveBeenCalledWith('http://api.test/api/autorizacao/reclassificacoes', etapa);
    expect(host.querySelector('h1')?.textContent).toContain(titulo);
  });

  it('mostra de cada item o perfil, a permissão, o que mudou, o instante e as concessões suspensas', async () => {
    const { host } = await abrir('protecao_de_dados');

    const subida = secao(host, 'Acompanhamento');
    expect(subida.textContent).toContain('selecao:processos:aprovar');
    expect(subida.textContent).toContain('Classificação: de Interna para Dado pessoal');
    expect(subida.textContent).not.toContain('Escopo: de');
    expect(subida.textContent).toContain('09/11/2026, 12:00');
    expect(subida.textContent).toContain('1 concessão');
    expect(subida.textContent).not.toContain('1 concessões');
    const escopo = secao(host, 'Auditoria');
    expect(escopo.textContent).toContain('Escopo: de Instituição para Unidade');
    expect(escopo.textContent).toContain('09/11/2026, 23:30');
    expect(escopo.textContent).toContain('4 concessões');
  });

  it('leva cada item ao detalhe da reclassificação', async () => {
    const { host } = await abrir('gestao_de_acessos');

    expect(secao(host, 'Auditoria').querySelector('a')?.getAttribute('href')).toBe(
      '/acessos/reclassificacoes/r2',
    );
  });

  it('lista os itens numa lista nomeada pela etapa, um li por reclassificação', async () => {
    const { host } = await abrir('gestao_de_acessos');

    const lista = host.querySelector('ul');
    expect(lista?.getAttribute('role')).toBe('list');
    expect(lista?.getAttribute('aria-label')).toBe('Reclassificações na gestão de acessos');
    expect(lista?.querySelectorAll(':scope > li')).toHaveLength(2);
  });

  it('diz que a fila está vazia, sem lista', async () => {
    const { host } = await abrir('gestao_de_acessos', ok([]));

    expect(host.textContent).toContain('Nenhuma reclassificação aguarda a sua decisão.');
    expect(host.querySelector('ul')).toBeNull();
  });

  it('com a leitura falha, não diz que a fila está vazia e oferece tentar novamente', async () => {
    const { fixture, host } = await abrir(
      'gestao_de_acessos',
      recusa('uniplus.internal.unexpected', 500, 'Erro interno'),
    );
    const tentar = (): HTMLButtonElement | undefined =>
      [...host.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === 'Tentar novamente',
      );

    expect(host.textContent).not.toContain('Nenhuma reclassificação aguarda');
    leitura.mockReturnValue(of(ok([SUBIDA])));
    tentar()?.click();
    await assentar(fixture);

    expect(host.querySelectorAll('section.panel')).toHaveLength(1);
  });

  it('sem permissão para a fila, mostra a recusa sem oferecer nova tentativa', async () => {
    const { host } = await abrir('gestao_de_acessos', recusa('uniplus.forbidden', 403));

    expect(
      [...host.querySelectorAll('button')].some(
        (b) => b.textContent?.trim() === 'Tentar novamente',
      ),
    ).toBe(false);
    expect(host.querySelectorAll('section.panel')).toHaveLength(0);
  });

  it('o catálogo desatualizado diz que o sistema está sendo atualizado', async () => {
    const { host } = await abrir(
      'gestao_de_acessos',
      recusa('uniplus.autorizacao.catalogo.desatualizado', 503, 'Catalog out of date'),
    );

    expect(host.textContent).toContain(
      'O sistema está sendo atualizado. Tente novamente em instantes.',
    );
  });
});
