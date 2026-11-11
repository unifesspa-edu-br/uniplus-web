import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { map, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  type DivergenciaDaGovernancaDto,
} from '@uniplus/shared-data/autorizacao';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { ok, recusa } from '../testes';
import { DivergenciasDaGovernancaPage } from './divergencias-da-governanca.page';

const FALTANTE: DivergenciaDaGovernancaDto = {
  id: 'd1',
  perfilId: 'p1',
  perfilNome: 'Gestão de acessos',
  codigo: 'autorizacao:perfis:manter',
  tipo: 'composicao_faltante',
  de: null,
  para: 'autorizacao:perfis:manter',
  instante: '2026-11-09T15:00:00Z',
};
const CLASSE: DivergenciaDaGovernancaDto = {
  ...FALTANTE,
  id: 'd2',
  perfilId: 'p2',
  perfilNome: 'Proteção de dados',
  tipo: 'classificacao',
  de: 'interno',
  para: 'sensivel',
};
const ESCOPO: DivergenciaDaGovernancaDto = {
  ...FALTANTE,
  id: 'd3',
  tipo: 'escopo',
  de: 'instituicao',
  para: 'unidade',
};

describe('DivergenciasDaGovernancaPage', () => {
  const leitura = vi.fn();
  const assentar = async (fixture: { detectChanges(): void; whenStable(): Promise<unknown> }) => {
    await new Promise((resolver) => setTimeout(resolver));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function abrir(
    corpo: unknown,
    concedidas: readonly string[] = [PERMISSAO.autorizacao.perfisManter],
  ) {
    leitura.mockReturnValue(of(corpo));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideMensagensDeAcesso(),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        provideHttpClient(
          withInterceptors([
            (req) => leitura(req.url).pipe(map((body: unknown) => new HttpResponse({ body }))),
          ]),
        ),
        { provide: NotificationService, useValue: { success: vi.fn(), errorFromProblem: vi.fn() } },
        { provide: PermissoesService, useValue: { tem: (c: string) => concedidas.includes(c) } },
      ],
    });
    const fixture = TestBed.createComponent(DivergenciasDaGovernancaPage);
    await assentar(fixture);
    return { fixture, host: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
  });

  it('lê as divergências da rota da governança', async () => {
    await abrir(ok([FALTANTE]));

    expect(leitura).toHaveBeenCalledWith('http://api.test/api/autorizacao/governanca/divergencias');
  });

  it('mostra cada divergência com o perfil, a permissão, o tipo e os valores na linguagem do tipo', async () => {
    const { host } = await abrir(ok([FALTANTE, CLASSE, ESCOPO]));

    const linhas = [...host.querySelectorAll('tbody tr')].map((l) => l.textContent ?? '');
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toContain('Permissão que falta na composição');
    expect(linhas[0]).toContain('—');
    expect(linhas[1]).toContain('Classificação diferente do catálogo');
    expect(linhas[1]).toContain('Interna');
    expect(linhas[1]).toContain('Dado sensível');
    expect(linhas[2]).toContain('Instituição');
    expect(linhas[2]).toContain('Unidade');
    expect(linhas[0]).toContain('09/11/2026, 12:00');
  });

  it('linka o perfil só para quem mantém perfis', async () => {
    const mantem = await abrir(ok([FALTANTE]));
    expect(mantem.host.querySelector('tbody a')?.getAttribute('href')).toBe('/acessos/perfis/p1');
    TestBed.resetTestingModule();

    const aprova = await abrir(ok([FALTANTE]), [
      PERMISSAO.autorizacao.perfisAprovarProtecaoDeDados,
    ]);
    expect(aprova.host.querySelector('tbody a')).toBeNull();
    expect(aprova.host.textContent).toContain('Gestão de acessos');
  });

  it('diz que não há divergência', async () => {
    const { host } = await abrir(ok([]));

    expect(host.textContent).toContain('Nenhuma divergência da governança foi encontrada.');
    expect(host.querySelector('table')).toBeNull();
  });

  it('com a leitura falha, oferece tentar novamente e não diz que não há divergência', async () => {
    const { host } = await abrir(recusa('uniplus.internal.unexpected', 500, 'Erro interno'));

    expect(host.textContent).not.toContain('Nenhuma divergência');
    expect(
      [...host.querySelectorAll('button')].some(
        (b) => b.textContent?.trim() === 'Tentar novamente',
      ),
    ).toBe(true);
  });

  it('sem permissão, mostra a recusa sem nova tentativa', async () => {
    const { host } = await abrir(recusa('uniplus.forbidden', 403));

    expect(
      [...host.querySelectorAll('button')].some(
        (b) => b.textContent?.trim() === 'Tentar novamente',
      ),
    ).toBe(false);
  });
});
