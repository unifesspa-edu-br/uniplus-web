import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PedidosDeConcessaoApi } from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { AnexoDoPedidoService } from './anexo-do-pedido.service';
import { PedidoDetalhePage } from './pedido-detalhe.page';
import { EU, concedidas, ok, pedido, recusa, UNIDADES } from './testes';

const GESTOR = 'autorizacao:pedidos:aprovar-funcional';
const ENCARREGADA = 'autorizacao:pedidos:aprovar-protecao-de-dados';

interface Interna {
  executar(): Promise<void>;
  pedirConfirmacao(acao: string): void;
  recusar(motivo: string): Promise<void>;
  anexar(arquivo: File | null): Promise<void>;
  abrirAnexo(id: string): Promise<void>;
  podeAceitar(): boolean;
  podeCancelar(): boolean;
  podeDecidir(): boolean;
  abrirRecusa(): void;
  recusando: { (): boolean; set?(v: boolean): void };
  erro(): string | null;
  erroDaRecusa(): string | null;
  erroDoAnexo(): string | null;
  anexando(): boolean;
  enviando(): boolean;
  carregando(): boolean;
}

async function esperar(fixture: { detectChanges(): void }): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver));
  fixture.detectChanges();
}

describe('PedidoDetalhePage', () => {
  const api = {
    obter: vi.fn(),
    trilha: vi.fn(),
    aprovar: vi.fn(),
    aceitar: vi.fn(),
    recusar: vi.fn(),
    cancelar: vi.fn(),
  };
  const anexos = { anexar: vi.fn(), abrir: vi.fn() };
  const notificacoes = { success: vi.fn() };

  async function abrir(
    permissoes: string[],
    resposta = pedido(),
    usuario: Partial<typeof EU> = {},
  ) {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
    api.obter.mockReturnValue(of(ok(resposta)));
    api.trilha.mockReturnValue(of(ok([])));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PedidosDeConcessaoApi, useValue: api },
        { provide: AnexoDoPedidoService, useValue: anexos },
        { provide: NotificationService, useValue: notificacoes },
        { provide: PermissoesService, useValue: concedidas(...permissoes) },
        { provide: UserContextService, useValue: { user: signal({ ...EU, ...usuario }) } },
        { provide: UnidadesApi, useValue: { listar: () => of(ok(UNIDADES)) } },
      ],
    });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PedidoDetalhePage);
    fixture.componentRef.setInput('id', resposta.id);
    fixture.detectChanges();
    await esperar(fixture);
    return {
      fixture,
      navegar,
      host: fixture.nativeElement as HTMLElement,
      pagina: fixture.componentInstance as unknown as Interna,
    };
  }

  const solicitadoPorMim = () => pedido({ solicitante: { emissor: 'unifesspa', sub: EU.id } });

  it('mostra o resumo, o escopo nomeado e a etapa em que o pedido está', async () => {
    const { host } = await abrir([]);

    expect(host.textContent).toContain('Operador de inscrições');
    expect(host.textContent).toContain('CEPS');
    expect(host.textContent).toContain('Betina Teste');
    expect(host.textContent).toContain('Gestor de acessos');
  });

  it('descarta o resultado de uma carga antiga quando o id já mudou', async () => {
    const { fixture, host, pagina } = await abrir([GESTOR]);
    const antigaObter = new Subject<ReturnType<typeof ok>>();
    api.obter.mockReturnValueOnce(antigaObter);
    api.trilha.mockReturnValueOnce(of(ok([])));
    fixture.componentRef.setInput('id', 'antigo');
    fixture.detectChanges();

    const novaObter = new Subject<ReturnType<typeof ok>>();
    api.obter.mockReturnValueOnce(novaObter);
    api.trilha.mockReturnValueOnce(of(ok([])));
    fixture.componentRef.setInput('id', 'novo');
    fixture.detectChanges();

    antigaObter.error(new Error('rede'));
    await esperar(fixture);

    expect(pagina.erro()).toBeNull();
    expect(pagina.carregando()).toBe(true);

    novaObter.next(ok(pedido({ id: 'novo', justificativa: 'Justificativa do novo.' })));
    novaObter.complete();
    await esperar(fixture);
    expect(pagina.carregando()).toBe(false);
    expect(host.textContent).toContain('Justificativa do novo.');
  });

  it('ao mudar só o id da rota, carrega o pedido novo em vez de manter o anterior', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    api.obter.mockReturnValue(
      of(ok(pedido({ id: 'outro', justificativa: 'Justificativa do outro.' }))),
    );

    fixture.componentRef.setInput('id', 'outro');
    fixture.detectChanges();
    await esperar(fixture);

    expect(api.obter).toHaveBeenLastCalledWith('outro');
    expect(host.textContent).toContain('Justificativa do outro.');
  });

  it('o gestor de acessos vê aprovar e recusar no pedido da etapa dele', async () => {
    const { pagina } = await abrir([GESTOR]);

    expect(pagina.podeDecidir()).toBe(true);
  });

  it('a encarregada não decide pedido que ainda aguarda o gestor', async () => {
    const { pagina } = await abrir([ENCARREGADA]);

    expect(pagina.podeDecidir()).toBe(false);
  });

  it('a encarregada decide o pedido da etapa dela', async () => {
    const { pagina } = await abrir(
      [ENCARREGADA],
      pedido({ situacao: 'aguardando_encarregada', etapaAtual: 'encarregada' }),
    );

    expect(pagina.podeDecidir()).toBe(true);
  });

  it('quem é parte do pedido não decide', async () => {
    const { pagina } = await abrir([GESTOR], solicitadoPorMim());
    expect(pagina.podeDecidir()).toBe(false);

    const outra = await abrir(
      [GESTOR],
      pedido({ beneficiario: { email: EU.email.toUpperCase(), identidade: null, nome: null } }),
    );
    expect(outra.pagina.podeDecidir()).toBe(false);
  });

  it('quem já decidiu como gestor não vê aprovar nem recusar na etapa da encarregada', async () => {
    const decisao = {
      etapa: 'gestor',
      decisor: { emissor: 'unifesspa', sub: EU.id },
      resultado: 'aprovado',
      motivo: null,
      instante: '2026-10-28T13:00:00Z',
      permissoesAvaliadas: [],
      sensibilidadeAvaliada: 'pessoal',
      dispensa: null,
    };
    const naEtapaDaEncarregada = pedido({
      situacao: 'aguardando_encarregada',
      etapaAtual: 'encarregada',
      decisoes: [decisao],
    });

    const { pagina } = await abrir([GESTOR, ENCARREGADA], naEtapaDaEncarregada);
    expect(pagina.podeDecidir()).toBe(false);

    const outro = await abrir(
      [GESTOR, ENCARREGADA],
      pedido({
        ...naEtapaDaEncarregada,
        decisoes: [{ ...decisao, decisor: { emissor: 'unifesspa', sub: 'sub-outro-gestor' } }],
      }),
    );
    expect(outro.pagina.podeDecidir()).toBe(true);
  });

  it('depois do perfil alterado, o gestor original reavalia e a encarregada que tentou conclui', async () => {
    const decisao = (etapa: string, resultado: string, sub: string) => ({
      etapa,
      decisor: { emissor: 'unifesspa', sub },
      resultado,
      motivo: null,
      instante: '2026-10-28T13:00:00Z',
      permissoesAvaliadas: [],
      sensibilidadeAvaliada: 'pessoal',
      dispensa: null,
    });
    const devolvido = pedido({
      decisoes: [
        decisao('gestor', 'aprovado', EU.id),
        decisao('encarregada', 'perfil_alterado', 'sub-outra-pessoa-2'),
      ],
    });

    const gestor = await abrir([GESTOR], devolvido);
    expect(gestor.pagina.podeDecidir()).toBe(true);

    const naEtapaDaEncarregada = pedido({
      situacao: 'aguardando_encarregada',
      etapaAtual: 'encarregada',
      decisoes: [
        decisao('gestor', 'aprovado', EU.id),
        decisao('encarregada', 'perfil_alterado', 'sub-encarregada-0'),
        decisao('gestor', 'aprovado', 'sub-outro-gestor'),
      ],
    });
    const encarregada = await abrir([ENCARREGADA], naEtapaDaEncarregada, {
      id: 'sub-encarregada-0',
    });
    expect(encarregada.pagina.podeDecidir()).toBe(true);

    const mesmoGestor = await abrir([GESTOR, ENCARREGADA], naEtapaDaEncarregada);
    expect(mesmoGestor.pagina.podeDecidir()).toBe(false);
  });

  it('depois de recusa da API, recarrega o pedido e mostra a etapa que a API tem', async () => {
    const { pagina, host, fixture } = await abrir([GESTOR, ENCARREGADA]);
    api.aprovar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.perfil_alterado', 409)));
    api.obter.mockReturnValue(
      of(ok(pedido({ situacao: 'aguardando_encarregada', etapaAtual: 'encarregada' }))),
    );

    pagina.pedirConfirmacao('aprovar');
    await pagina.executar();
    await esperar(fixture);

    expect(api.obter).toHaveBeenCalledTimes(2);
    expect(pagina.erro()).toBe('Recusado');
    expect(host.textContent).toContain('Encarregada de dados');
  });

  it('fecha o diálogo de recusa quando o pedido já não está na etapa da pessoa', async () => {
    const { pagina } = await abrir([GESTOR]);
    pagina.abrirRecusa();
    api.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.etapa_invalida')));
    api.obter.mockReturnValue(
      of(ok(pedido({ situacao: 'aguardando_encarregada', etapaAtual: 'encarregada' }))),
    );

    await pagina.recusar('Motivo.');

    expect(pagina.podeDecidir()).toBe(false);
    expect(pagina.recusando()).toBe(false);
    expect(pagina.erro()).toBe('Recusado');
  });

  it('aprova e recarrega o pedido', async () => {
    const { pagina } = await abrir([GESTOR]);
    api.aprovar.mockReturnValue(of(ok(pedido({ situacao: 'aguardando_encarregada' }))));

    pagina.pedirConfirmacao('aprovar');
    await pagina.executar();

    expect(api.aprovar).toHaveBeenCalledWith('pedido-1', expect.anything());
    expect(notificacoes.success).toHaveBeenCalledWith('Pedido atualizado');
    expect(api.obter).toHaveBeenCalledTimes(2);
  });

  it('mostra a recusa de quem decide o pedido de que é parte e relê o pedido', async () => {
    const { pagina } = await abrir([GESTOR]);
    api.aprovar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.decisor_e_parte')));

    pagina.pedirConfirmacao('aprovar');
    await pagina.executar();

    expect(pagina.erro()).toBe('Recusado');
    expect(api.obter).toHaveBeenCalledTimes(2);
  });

  it('recusa com motivo e fecha o diálogo', async () => {
    const { pagina } = await abrir([GESTOR]);
    api.recusar.mockReturnValue(of(ok(pedido({ situacao: 'recusado', etapaAtual: null }))));

    await pagina.recusar('Sem necessidade funcional.');

    expect(api.recusar.mock.calls[0]?.slice(0, 2)).toEqual([
      'pedido-1',
      'Sem necessidade funcional.',
    ]);
    expect(pagina.recusando()).toBe(false);
  });

  it('mantém o diálogo de recusa com o erro da API', async () => {
    const { pagina } = await abrir([GESTOR]);
    api.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.motivo_invalido')));

    pagina.abrirRecusa();
    await pagina.recusar('x');

    expect(pagina.erroDaRecusa()).toBe('Recusado');
    expect(pagina.recusando()).toBe(true);
  });

  it('reabrir o diálogo de recusa não mostra o erro da tentativa anterior', async () => {
    const { pagina } = await abrir([GESTOR]);
    api.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.motivo_invalido')));
    pagina.abrirRecusa();
    await pagina.recusar('x');
    pagina.recusando.set?.(false);

    pagina.abrirRecusa();

    expect(pagina.erroDaRecusa()).toBeNull();
    expect(pagina.recusando()).toBe(true);
  });

  it('o beneficiário nomeado aceita o pedido que espera por ele', async () => {
    const aguardando = pedido({
      situacao: 'aguardando_beneficiario',
      etapaAtual: null,
      beneficiario: { email: EU.email, identidade: null, nome: null },
    });
    const { pagina } = await abrir([], aguardando);
    api.aceitar.mockReturnValue(of(ok(pedido())));

    expect(pagina.podeAceitar()).toBe(true);
    pagina.pedirConfirmacao('aceitar');
    await pagina.executar();

    expect(api.aceitar).toHaveBeenCalled();
  });

  it('o solicitante cancela antes da primeira decisão e volta à lista', async () => {
    const { pagina, navegar } = await abrir([], solicitadoPorMim());
    api.cancelar.mockReturnValue(of(ok(undefined)));

    expect(pagina.podeCancelar()).toBe(true);
    pagina.pedirConfirmacao('cancelar');
    await pagina.executar();

    expect(navegar).toHaveBeenCalledWith(['/acessos/pedidos']);
  });

  it('não oferece cancelar depois da decisão nem no pedido encerrado', async () => {
    const decisao = {
      etapa: 'gestor',
      decisor: { emissor: 'unifesspa', sub: 'sub-gestor-0000' },
      resultado: 'aprovado',
      motivo: null,
      instante: '2026-10-28T13:00:00Z',
      permissoesAvaliadas: [],
      sensibilidadeAvaliada: 'pessoal',
      dispensa: null,
    };
    const decidido = await abrir([], { ...solicitadoPorMim(), decisoes: [decisao] });
    expect(decidido.pagina.podeCancelar()).toBe(false);
    expect(decidido.host.textContent).toContain('Dado pessoal');

    const encerrado = await abrir([], { ...solicitadoPorMim(), situacao: 'aprovado' });
    expect(encerrado.pagina.podeCancelar()).toBe(false);
  });

  it('mostra a recusa do cancelamento sem sair da página', async () => {
    const { pagina, navegar } = await abrir([], solicitadoPorMim());
    api.cancelar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.situacao_invalida')));

    pagina.pedirConfirmacao('cancelar');
    await pagina.executar();

    expect(pagina.erro()).toBe('Recusado');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('destaca a pendência e a ação de anexar quando o pedido aguarda o documento', async () => {
    const { host } = await abrir(
      [],
      pedido({ ...solicitadoPorMim(), situacao: 'aguardando_documento', etapaAtual: null }),
    );

    expect(host.textContent).toContain('Falta o documento de designação');
    expect(host.textContent).toContain('Aguardando o documento de designação');
    const botoes = Array.from(host.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(botoes).toContain('Anexar o documento');
  });

  it('anexa o documento do solicitante e recarrega o pedido', async () => {
    const { pagina } = await abrir([], solicitadoPorMim());
    anexos.anexar.mockResolvedValue({ ok: true });

    await pagina.anexar(new File(['%PDF'], 'd.pdf', { type: 'application/pdf' }));

    expect(anexos.anexar).toHaveBeenCalled();
    expect(api.obter).toHaveBeenCalledTimes(2);
  });

  it('libera o seletor de arquivo quando o envio do anexo falha com exceção', async () => {
    const { pagina } = await abrir([], solicitadoPorMim());
    anexos.anexar.mockRejectedValue(new Error('rede'));

    await pagina.anexar(new File(['%PDF'], 'd.pdf', { type: 'application/pdf' }));

    expect(pagina.anexando()).toBe(false);
    expect(pagina.erroDoAnexo()).not.toBeNull();
  });

  it('ignora o segundo clique em cancelar enquanto o primeiro está em andamento', async () => {
    const { pagina } = await abrir([], solicitadoPorMim());
    const resposta = new Subject<ReturnType<typeof ok>>();
    api.cancelar.mockReturnValue(resposta);

    pagina.pedirConfirmacao('cancelar');
    const primeiro = pagina.executar();
    await pagina.executar();
    resposta.next(ok(undefined));
    resposta.complete();
    await primeiro;

    expect(api.cancelar).toHaveBeenCalledTimes(1);
    expect(pagina.enviando()).toBe(false);
  });

  it('libera a ação e mostra o erro quando o cancelamento falha com exceção', async () => {
    const { pagina } = await abrir([], solicitadoPorMim());
    api.cancelar.mockReturnValue(throwError(() => new Error('rede')));

    pagina.pedirConfirmacao('cancelar');
    await pagina.executar();

    expect(pagina.enviando()).toBe(false);
    expect(pagina.erro()).toContain('Não foi possível concluir a operação');
  });

  it('mostra a falha do anexo no próprio campo', async () => {
    const { pagina } = await abrir([], solicitadoPorMim());
    anexos.anexar.mockResolvedValue({ ok: false, mensagem: 'Falha ao enviar o arquivo.' });

    await pagina.anexar(new File(['%PDF'], 'd.pdf', { type: 'application/pdf' }));

    expect(pagina.erroDoAnexo()).toBe('Falha ao enviar o arquivo.');
  });

  it('abre só o documento verificado e explica o bloqueio de janelas', async () => {
    const comAnexo = pedido({
      anexos: [
        {
          id: 'a1',
          situacao: 'verificado',
          tamanhoDeclarado: 10,
          enviadoEm: '2026-10-28T12:30:00Z',
        },
        { id: 'a2', situacao: 'em_verificacao', tamanhoDeclarado: 10, enviadoEm: null },
      ],
    });
    const { host, pagina } = await abrir([GESTOR], comAnexo);
    anexos.abrir.mockResolvedValue('bloqueada');

    expect(host.textContent).toContain('Em verificação');
    expect(host.textContent?.match(/Abrir documento/gu)).toHaveLength(1);
    await pagina.abrirAnexo('a1');

    expect(pagina.erro()).toContain('bloqueou');
  });

  it('mostra a recusa da API ao ler um pedido que a pessoa não pode ver', async () => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
    api.obter.mockReturnValue(
      of(recusa('uniplus.autorizacao.pedido.nao_encontrado', 404, 'Não encontrado')),
    );
    api.trilha.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.nao_encontrado', 404)));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: PedidosDeConcessaoApi, useValue: api },
        { provide: AnexoDoPedidoService, useValue: anexos },
        { provide: PermissoesService, useValue: concedidas() },
        { provide: UserContextService, useValue: { user: signal(EU) } },
        { provide: UnidadesApi, useValue: { listar: () => of(ok(UNIDADES)) } },
      ],
    });
    const fixture = TestBed.createComponent(PedidoDetalhePage);
    fixture.componentRef.setInput('id', 'x');
    fixture.detectChanges();
    await esperar(fixture);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Não encontrado');
  });

  beforeEach(() => TestBed.resetTestingModule());
});
