import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { ConcessoesApi, type ConcessaoDto } from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { ConcessoesPage } from './concessoes.page';
import { ok, recusa, UNIDADES } from './testes';

const ativa: ConcessaoDto = {
  id: 'c1',
  beneficiario: { emissor: 'unifesspa', sub: '0123456789abcdef' },
  perfil: { id: 'p1', nome: 'Operador de inscrições' },
  escopo: { tipo: 'unidade', unidadeId: 'unidade-1' },
  origem: { tipo: 'pedido', id: 'pedido-1' },
  concedidaEm: '2026-10-28T12:00:00Z',
  validaAte: null,
  revogadaEm: null,
  revogadaPor: null,
  motivoRevogacao: null,
  ativa: true,
};

describe('ConcessoesPage', () => {
  const api = { listar: vi.fn(), trilha: vi.fn(), revogar: vi.fn() };
  const notificacoes = { success: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    api.listar.mockReturnValue(of(ok([ativa])));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ConcessoesApi, useValue: api },
        { provide: NotificationService, useValue: notificacoes },
        { provide: UnidadesApi, useValue: { listar: () => of(ok(UNIDADES)) } },
      ],
    });
  });

  function abrir() {
    const fixture = TestBed.createComponent(ConcessoesPage);
    fixture.detectChanges();
    const pagina = fixture.componentInstance as unknown as {
      abrirTrilha(c: ConcessaoDto): Promise<void>;
      pedirRevogacao(c: ConcessaoDto): void;
      revogar(motivo: string, email: string): Promise<void>;
      erroDoEmail: { (): string | null };
      filtrarPor(s: string): void;
      situacaoDe(c: ConcessaoDto): { texto: string };
      revogando: { (): boolean };
      erroDaRevogacao: { (): string | null };
      trilha: { (): unknown[] };
    };
    return { fixture, host: fixture.nativeElement as HTMLElement, pagina };
  }

  it('lista as ativas por padrão, com a pessoa abreviada e o vínculo com o pedido', () => {
    const { host } = abrir();

    expect(api.listar.mock.calls[0]?.[0]).toMatchObject({ situacao: 'ativa' });
    expect(host.textContent).toContain('Pessoa 01234567');
    expect(host.textContent).not.toContain('0123456789abcdef');
    expect(host.textContent).toContain('CEPS');
    expect(host.querySelector('a[href="/acessos/pedidos/pedido-1"]')).not.toBeNull();
    expect(host.querySelector('button[aria-label^="Revogar a concessão"]')).not.toBeNull();
  });

  it('não oferece a revogação da concessão que já não vale', () => {
    api.listar.mockReturnValue(
      of(ok([{ ...ativa, ativa: false, revogadaEm: '2026-10-29T00:00:00Z' }])),
    );

    const { host, pagina } = abrir();

    expect(host.querySelector('button[aria-label^="Revogar a concessão"]')).toBeNull();
    expect(pagina.situacaoDe({ ...ativa, ativa: false, revogadaEm: 'x' }).texto).toBe('Revogada');
    expect(pagina.situacaoDe({ ...ativa, ativa: false }).texto).toBe('Vencida');
  });

  it('carrega a trilha da concessão', async () => {
    api.trilha.mockReturnValue(
      of(
        ok([
          {
            tipo: 'concedida',
            instante: '2026-10-28T12:00:00Z',
            autor: ativa.beneficiario,
            detalhe: null,
          },
        ]),
      ),
    );
    const { pagina } = abrir();

    await pagina.abrirTrilha(ativa);

    expect(api.trilha).toHaveBeenCalledWith('c1');
    expect(pagina.trilha()).toHaveLength(1);
  });

  it('descarta a trilha que chega atrasada de uma concessão que já não está aberta', async () => {
    const outra: ConcessaoDto = { ...ativa, id: 'c2' };
    const evento = (tipo: string) => ({
      tipo,
      instante: '2026-10-28T12:00:00Z',
      autor: ativa.beneficiario,
      detalhe: null,
    });
    const daPrimeira = new Subject<ReturnType<typeof ok>>();
    const daSegunda = new Subject<ReturnType<typeof ok>>();
    api.trilha.mockImplementation((id: string) => (id === 'c1' ? daPrimeira : daSegunda));
    const { pagina } = abrir();

    const primeira = pagina.abrirTrilha(ativa);
    const segunda = pagina.abrirTrilha(outra);
    daSegunda.next(ok([evento('revogada')]));
    await segunda;
    daPrimeira.next(ok([evento('concedida'), evento('concedida')]));
    await primeira;

    expect(pagina.trilha()).toHaveLength(1);
  });

  it('revoga com o motivo, avisa e recarrega a lista', async () => {
    api.revogar.mockReturnValue(of(ok(undefined)));
    const { pagina } = abrir();

    pagina.pedirRevogacao(ativa);
    await pagina.revogar('Mudou de unidade.', 'betina@uniplus-test.local');

    expect(api.revogar.mock.calls[0]?.slice(0, 2)).toEqual([
      'c1',
      { motivo: 'Mudou de unidade.', confirmacaoEmail: 'betina@uniplus-test.local' },
    ]);
    expect(notificacoes.success).toHaveBeenCalledWith('Concessão revogada');
    expect(pagina.revogando()).toBe(false);
    expect(api.listar).toHaveBeenCalledTimes(2);
  });

  it('mantém o diálogo aberto com a recusa quando a API não revoga', async () => {
    api.revogar.mockReturnValue(of(recusa('uniplus.autorizacao.concessao.minimo_de_gestores')));
    const { pagina } = abrir();

    pagina.pedirRevogacao(ativa);
    await pagina.revogar('Saiu da função.', 'betina@uniplus-test.local');

    expect(pagina.revogando()).toBe(true);
    expect(pagina.erroDaRevogacao()).toBe('Recusado');
    expect(notificacoes.success).not.toHaveBeenCalled();
  });

  it('mostra no campo de e-mail a recusa da confirmação divergente', async () => {
    api.revogar.mockReturnValue(of(recusa('uniplus.autorizacao.concessao.confirmacao_divergente')));
    const { pagina } = abrir();

    pagina.pedirRevogacao(ativa);
    await pagina.revogar('Saiu da função.', 'outra@uniplus-test.local');

    expect(pagina.revogando()).toBe(true);
    expect(pagina.erroDoEmail()).toBe('Recusado');
    expect(pagina.erroDaRevogacao()).toBeNull();
  });

  it('recarrega pela situação escolhida', () => {
    const { pagina } = abrir();

    pagina.filtrarPor('todas');

    expect(api.listar).toHaveBeenLastCalledWith(expect.objectContaining({ situacao: 'todas' }));
  });
});
