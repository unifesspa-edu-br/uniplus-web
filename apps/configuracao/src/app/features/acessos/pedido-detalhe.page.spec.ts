import {
  HttpHeaders,
  HttpResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { map } from 'rxjs';
import { AUTORIZACAO_BASE_PATH } from '@uniplus/shared-data/autorizacao';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissoesService, UserContextService } from '@uniplus/shared-auth/bootstrap';
import { apiFailure } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PedidosDeConcessaoApi } from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { AnexoDoPedidoService } from './anexo-do-pedido.service';
import { EdicaoDoPedido } from './edicao-do-pedido';
import { PedidoDetalhePage } from './pedido-detalhe.page';
import { EU, concedidas, ok, pedido, recusa, UNIDADES } from './testes';

function presente<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error('elemento ausente');
  return valor;
}

const GESTOR = 'autorizacao:pedidos:aprovar-funcional';
const PROTECAO_DE_DADOS = 'autorizacao:pedidos:aprovar-protecao-de-dados';

interface Interna {
  executar(): Promise<void>;
  pedirConfirmacao(acao: string): void;
  recusar(): Promise<void>;
  motivo: { setValue(valor: string): void };
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
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        provideHttpClient(
          withInterceptors([
            (req) =>
              (req.url.endsWith('/trilha')
                ? api.trilha(decodeURIComponent(req.url.split('/').at(-2) ?? ''))
                : api.obter(decodeURIComponent(req.url.split('/').at(-1) ?? ''))
              ).pipe(map((body: unknown) => new HttpResponse({ body }))),
          ]),
        ),
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

  it('a proteção de dados não decide pedido que ainda aguarda o gestor', async () => {
    const { pagina } = await abrir([PROTECAO_DE_DADOS]);

    expect(pagina.podeDecidir()).toBe(false);
  });

  it('a proteção de dados decide o pedido da etapa dela', async () => {
    const { pagina } = await abrir(
      [PROTECAO_DE_DADOS],
      pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' }),
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

  it('quem já decidiu como gestor não vê aprovar nem recusar na etapa da proteção de dados', async () => {
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
    const naEtapaDaProtecaoDeDados = pedido({
      situacao: 'aguardando_protecao_de_dados',
      etapaAtual: 'protecao_de_dados',
      decisoes: [decisao],
    });

    const { pagina } = await abrir([GESTOR, PROTECAO_DE_DADOS], naEtapaDaProtecaoDeDados);
    expect(pagina.podeDecidir()).toBe(false);

    const outro = await abrir(
      [GESTOR, PROTECAO_DE_DADOS],
      pedido({
        ...naEtapaDaProtecaoDeDados,
        decisoes: [{ ...decisao, decisor: { emissor: 'unifesspa', sub: 'sub-outro-gestor' } }],
      }),
    );
    expect(outro.pagina.podeDecidir()).toBe(true);
  });

  it('depois do perfil alterado, o gestor original reavalia e a proteção de dados que tentou conclui', async () => {
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
        decisao('protecao_de_dados', 'perfil_alterado', 'sub-outra-pessoa-2'),
      ],
    });

    const gestor = await abrir([GESTOR], devolvido);
    expect(gestor.pagina.podeDecidir()).toBe(true);

    const naEtapaDaProtecaoDeDados = pedido({
      situacao: 'aguardando_protecao_de_dados',
      etapaAtual: 'protecao_de_dados',
      decisoes: [
        decisao('gestor', 'aprovado', EU.id),
        decisao('protecao_de_dados', 'perfil_alterado', 'sub-protecao-de-dados-0'),
        decisao('gestor', 'aprovado', 'sub-outro-gestor'),
      ],
    });
    const protecaoDeDados = await abrir([PROTECAO_DE_DADOS], naEtapaDaProtecaoDeDados, {
      id: 'sub-protecao-de-dados-0',
    });
    expect(protecaoDeDados.pagina.podeDecidir()).toBe(true);

    const mesmoGestor = await abrir([GESTOR, PROTECAO_DE_DADOS], naEtapaDaProtecaoDeDados);
    expect(mesmoGestor.pagina.podeDecidir()).toBe(false);
  });

  it('depois de recusa da API, recarrega o pedido e mostra a etapa que a API tem', async () => {
    const { pagina, host, fixture } = await abrir([GESTOR, PROTECAO_DE_DADOS]);
    api.aprovar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.perfil_alterado', 409)));
    api.obter.mockReturnValue(
      of(ok(pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' }))),
    );

    pagina.pedirConfirmacao('aprovar');
    await pagina.executar();
    await esperar(fixture);

    expect(api.obter).toHaveBeenCalledTimes(2);
    expect(pagina.erro()).toBe('Recusado');
    expect(host.textContent).toContain('Encarregado(a) pelo tratamento de dados');
  });

  it('mantém a confirmação aberta e impede outra decisão durante o envio', async () => {
    const { fixture, host, pagina } = await abrir([GESTOR]);
    const resposta = new Subject<ReturnType<typeof ok>>();
    api.aprovar.mockReturnValue(resposta);
    pagina.pedirConfirmacao('aprovar');
    fixture.detectChanges();
    const dialogo = host.querySelector('ui-dialog');
    const botoes = dialogo?.querySelectorAll('button');
    const confirmar = [...(botoes ?? [])].find((botao) => botao.textContent?.includes('Aprovar'));
    confirmar?.click();
    fixture.detectChanges();

    expect(pagina.enviando()).toBe(true);
    expect(confirmar?.getAttribute('aria-disabled')).toBe('true');
    expect(dialogo?.querySelector('[role="status"]')?.textContent).toContain('Enviando');
    expect(
      [...presente(dialogo).querySelectorAll('button')].find((botao) =>
        botao.textContent?.includes('Voltar'),
      )?.disabled,
    ).toBe(true);
    confirmar?.click();
    expect(api.aprovar).toHaveBeenCalledTimes(1);

    resposta.next(ok(pedido()));
    resposta.complete();
    await esperar(fixture);
    expect(dialogo?.querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it('fecha o diálogo de recusa quando o pedido já não está na etapa da pessoa', async () => {
    const { pagina, fixture } = await abrir([GESTOR]);
    pagina.abrirRecusa();
    api.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.etapa_invalida')));
    api.obter.mockReturnValue(
      of(ok(pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' }))),
    );

    pagina.motivo.setValue('Motivo.');
    await pagina.recusar();
    await esperar(fixture);

    expect(pagina.podeDecidir()).toBe(false);
    expect(pagina.recusando()).toBe(false);
    expect(pagina.erro()).toBe('Recusado');
  });

  it('bloqueia nova decisão após recusa da API até reavaliar o pedido recarregado', async () => {
    const { pagina, fixture } = await abrir([GESTOR]);
    const recarga = new Subject<ReturnType<typeof ok>>();
    api.obter.mockReturnValue(recarga);
    api.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.perfil_alterado')));
    pagina.abrirRecusa();
    pagina.motivo.setValue('Motivo');
    await pagina.recusar();
    await esperar(fixture);

    expect(pagina.carregando()).toBe(true);
    await pagina.recusar();
    pagina.pedirConfirmacao('aprovar');
    await pagina.executar();
    expect(api.recusar).toHaveBeenCalledTimes(1);
    expect(api.aprovar).not.toHaveBeenCalled();

    recarga.next(
      ok(pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' })),
    );
    recarga.complete();
    await esperar(fixture);
    expect(pagina.podeDecidir()).toBe(false);
    expect(pagina.recusando()).toBe(false);
    await pagina.recusar();
    expect(api.recusar).toHaveBeenCalledTimes(1);
  });

  it('aprova e recarrega o pedido', async () => {
    const { pagina, fixture } = await abrir([GESTOR]);
    api.aprovar.mockReturnValue(of(ok(pedido({ situacao: 'aguardando_protecao_de_dados' }))));

    pagina.pedirConfirmacao('aprovar');
    await pagina.executar();
    await esperar(fixture);

    expect(api.aprovar).toHaveBeenCalledWith('pedido-1', expect.anything(), null);
    expect(notificacoes.success).toHaveBeenCalledWith('Pedido atualizado');
    expect(api.obter).toHaveBeenCalledTimes(2);
  });

  describe('fim de vigência', () => {
    const campo = (host: HTMLElement) => host.querySelector<HTMLInputElement>('input[type="date"]');
    const digitar = (host: HTMLElement, valor: string) => {
      const el = presente(campo(host));
      el.value = valor;
      el.dispatchEvent(new Event('input'));
    };

    it('o gestor vê o campo pré-preenchido com o prazo sugerido e o envia ao aprovar', async () => {
      const { pagina, host } = await abrir(
        [GESTOR],
        pedido({ validaAteSugerida: '2099-06-15T15:00:00Z' }),
      );
      api.aprovar.mockReturnValue(of(ok(pedido({ situacao: 'aguardando_protecao_de_dados' }))));

      expect(campo(host)?.value).toBe('2099-06-15');
      pagina.pedirConfirmacao('aprovar');
      await pagina.executar();

      expect(api.aprovar).toHaveBeenCalledWith(
        'pedido-1',
        expect.anything(),
        expect.stringMatching(/^2099-06-15T23:59:59[+-]\d{2}:\d{2}$/),
      );
    });

    it('o gestor limpa o prazo sugerido e aprova sem validaAte', async () => {
      const { pagina, host } = await abrir(
        [GESTOR],
        pedido({ validaAteSugerida: '2099-06-15T15:00:00Z' }),
      );
      api.aprovar.mockReturnValue(of(ok(pedido())));

      digitar(host, '');
      pagina.pedirConfirmacao('aprovar');
      await pagina.executar();

      expect(api.aprovar).toHaveBeenCalledWith('pedido-1', expect.anything(), null);
    });

    it('não pré-preenche uma sugestão que já venceu', async () => {
      const { host } = await abrir([GESTOR], pedido({ validaAteSugerida: '2020-01-01T15:00:00Z' }));

      expect(campo(host)?.value).toBe('');
    });

    it('o erro e o aria-invalid somem quando o gestor corrige a data', async () => {
      const { pagina, host, fixture } = await abrir([GESTOR]);
      digitar(host, '2020-01-01');
      pagina.pedirConfirmacao('aprovar');
      fixture.detectChanges();
      expect(campo(host)?.getAttribute('aria-invalid')).toBe('true');

      digitar(host, '2099-01-01');
      fixture.detectChanges();

      expect(campo(host)?.getAttribute('aria-invalid')).toBeNull();
      expect(host.querySelector('#cfg-pedido-prazo-erro')).toBeNull();
    });

    it('recusa data passada, liga o erro ao campo e não abre a confirmação', async () => {
      const { pagina, host, fixture } = await abrir([GESTOR]);

      digitar(host, '2020-01-01');
      pagina.pedirConfirmacao('aprovar');
      fixture.detectChanges();

      expect(api.aprovar).not.toHaveBeenCalled();
      expect(campo(host)?.getAttribute('aria-describedby')).toContain('cfg-pedido-prazo-erro');
      expect(host.querySelector('#cfg-pedido-prazo-erro')?.textContent).toContain('já passou');
    });

    it('ao aprovar com prazo inválido, o resumo encaminha o foco ao campo', async () => {
      const { host, fixture } = await abrir([GESTOR]);
      digitar(host, '2020-01-01');
      const focar = vi.spyOn(presente(campo(host)), 'focus');
      const aprovar = [...host.querySelectorAll('cfg-pedido-resumo button')].find(
        (botao) => botao.textContent?.trim() === 'Aprovar',
      );

      presente(aprovar).click();
      fixture.detectChanges();

      expect(focar).toHaveBeenCalled();
      expect(campo(host)?.getAttribute('aria-invalid')).toBe('true');
      expect(api.aprovar).not.toHaveBeenCalled();
    });

    it('perfil que não admite prazo não mostra o campo e aprova sem validaAte', async () => {
      const { pagina, host } = await abrir([GESTOR], pedido({ admitePrazo: false }));
      api.aprovar.mockReturnValue(of(ok(pedido())));

      expect(campo(host)).toBeNull();
      pagina.pedirConfirmacao('aprovar');
      await pagina.executar();

      expect(api.aprovar).toHaveBeenCalledWith('pedido-1', expect.anything(), null);
    });

    it('na etapa da proteção de dados não há campo, mas o prazo do gestor aparece', async () => {
      const { pagina, host } = await abrir(
        [PROTECAO_DE_DADOS],
        pedido({
          situacao: 'aguardando_protecao_de_dados',
          etapaAtual: 'protecao_de_dados',
          validaAte: '2099-06-15T23:59:59-03:00',
        }),
      );
      api.aprovar.mockReturnValue(of(ok(pedido())));

      expect(campo(host)).toBeNull();
      expect(host.textContent).toContain('Fim de vigência definido pelo gestor');
      pagina.pedirConfirmacao('aprovar');
      await pagina.executar();
      expect(api.aprovar).toHaveBeenCalledWith('pedido-1', expect.anything(), null);
    });
  });

  it('mostra a recusa de quem decide o pedido de que é parte e relê o pedido', async () => {
    const { pagina, fixture } = await abrir([GESTOR]);
    api.aprovar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.decisor_e_parte')));

    pagina.pedirConfirmacao('aprovar');
    await pagina.executar();
    await esperar(fixture);

    expect(pagina.erro()).toBe('Recusado');
    expect(api.obter).toHaveBeenCalledTimes(2);
  });

  it.each(['aprovar', 'recusar'] as const)(
    'fecha o diálogo de %s quando a recarga falha e permite tentar novamente',
    async (acao) => {
      const { fixture, host, pagina } = await abrir([GESTOR]);
      document.body.append(host);
      const recarga = new Subject<ReturnType<typeof ok>>();
      api.obter.mockReturnValue(recarga);
      api[acao].mockReturnValue(of(recusa('uniplus.autorizacao.pedido.situacao_invalida')));
      if (acao === 'aprovar') {
        pagina.pedirConfirmacao('aprovar');
        fixture.detectChanges();
        await pagina.executar();
      } else {
        pagina.abrirRecusa();
        pagina.motivo.setValue('Motivo');
        fixture.detectChanges();
        await pagina.recusar();
      }
      await esperar(fixture);
      const decisoes = [...host.querySelectorAll<HTMLButtonElement>('cfg-pedido-resumo .btn')];
      expect(decisoes.map((botao) => botao.getAttribute('aria-disabled'))).toEqual([
        'true',
        'true',
      ]);
      decisoes.forEach((botao) => botao.click());
      fixture.detectChanges();
      expect(api[acao]).toHaveBeenCalledTimes(1);

      recarga.error(new Error('rede'));
      await esperar(fixture);
      await esperar(fixture);
      const tentar = host.querySelector<HTMLButtonElement>('#tentar-pedido');
      expect(host.querySelector('ui-dialog dialog[open]')).toBeNull();
      expect(host.querySelector('cfg-motivo-dialog dialog[open]')).toBeNull();
      expect(host.querySelector('ui-alert')?.textContent).toContain(pagina.erro());
      expect(document.activeElement).toBe(tentar);
      api.obter.mockReturnValue(of(ok(pedido())));
      tentar?.click();
      await esperar(fixture);
      expect(api.obter).toHaveBeenCalledTimes(3);
      expect(host.querySelector('#tentar-pedido')).toBeNull();
      host.remove();
    },
  );

  it('ao reabrir a recusa limpa o motivo e a validação anterior', async () => {
    const { fixture, host, pagina } = await abrir([GESTOR]);
    pagina.abrirRecusa();
    fixture.detectChanges();
    await pagina.recusar();
    await esperar(fixture);
    const campo = host.querySelector<HTMLTextAreaElement>('cfg-motivo-dialog textarea');
    expect(campo?.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(campo);
    pagina.motivo.setValue('Motivo anterior');
    pagina.recusando.set?.(false);
    pagina.abrirRecusa();
    fixture.detectChanges();
    expect(campo?.value).toBe('');
    expect(campo?.getAttribute('aria-invalid')).toBeNull();
  });

  it('impede decisões concorrentes e mantém o diálogo aberto durante o envio', async () => {
    const { fixture, host, pagina } = await abrir([GESTOR]);
    const resposta = new Subject<ReturnType<typeof ok>>();
    api.recusar.mockReturnValue(resposta);
    pagina.abrirRecusa();
    pagina.motivo.setValue('Motivo');
    fixture.detectChanges();
    const edicao = fixture.debugElement.injector.get(EdicaoDoPedido);
    const envio = pagina.recusar();
    fixture.detectChanges();
    const campo = host.querySelector<HTMLTextAreaElement>('cfg-motivo-dialog textarea');
    const botao = host.querySelector<HTMLButtonElement>('cfg-motivo-dialog .btn--danger');
    expect(campo?.matches(':disabled')).toBe(true);
    expect(botao?.getAttribute('aria-disabled')).toBe('true');
    expect(host.querySelector('cfg-motivo-dialog [role="status"]')?.textContent).toContain(
      'Enviando decisão',
    );
    botao?.click();
    void edicao.recusar(signal(true));
    void edicao.executar(false);
    host
      .querySelector('cfg-motivo-dialog dialog')
      ?.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(edicao.recusando()).toBe(true);
    expect(api.recusar).toHaveBeenCalledTimes(1);
    expect(api.aprovar).not.toHaveBeenCalled();
    resposta.next(ok(pedido()));
    resposta.complete();
    await envio;
    expect(edicao.recusando()).toBe(false);
  });

  it('mostra e foca o motivo recusado pelo servidor', async () => {
    const { fixture, host, pagina } = await abrir([GESTOR]);
    api.recusar.mockReturnValue(
      of(
        apiFailure(
          {
            type: 'x',
            title: 'Dados inválidos',
            status: 422,
            code: 'uniplus.validacao',
            traceId: '',
            errors: [
              {
                field: 'Motivo',
                code: 'uniplus.autorizacao.pedido.motivo_invalido',
                message: 'Motivo recusado.',
              },
            ],
          },
          422,
          new HttpHeaders(),
        ),
      ),
    );
    pagina.abrirRecusa();
    pagina.motivo.setValue('Motivo');
    fixture.detectChanges();
    await pagina.recusar();
    await esperar(fixture);
    await esperar(fixture);
    const campo = host.querySelector<HTMLTextAreaElement>('cfg-motivo-dialog textarea');
    expect(campo?.getAttribute('aria-invalid')).toBe('true');
    expect(host.textContent).toContain('Motivo recusado.');
    expect(document.activeElement).toBe(campo);
  });

  it('recusa com motivo e fecha o diálogo', async () => {
    const { pagina } = await abrir([GESTOR]);
    api.recusar.mockReturnValue(of(ok(pedido({ situacao: 'recusado', etapaAtual: null }))));

    pagina.motivo.setValue('Sem necessidade funcional.');
    await pagina.recusar();

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
    pagina.motivo.setValue('x');
    await pagina.recusar();

    expect(pagina.erroDaRecusa()).toBe('Recusado');
    expect(pagina.recusando()).toBe(true);
  });

  it('reabrir o diálogo de recusa não mostra o erro da tentativa anterior', async () => {
    const { pagina, fixture } = await abrir([GESTOR]);
    api.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.motivo_invalido')));
    pagina.abrirRecusa();
    pagina.motivo.setValue('x');
    await pagina.recusar();
    await esperar(fixture);
    pagina.recusando.set?.(false);

    pagina.abrirRecusa();

    expect(pagina.erroDaRecusa()).toBeNull();
    expect(pagina.recusando()).toBe(true);
  });

  it('aplica a decisão retornada enquanto a recarga está pendente', async () => {
    const { pagina, fixture, host } = await abrir([GESTOR]);
    const recarga = new Subject<ReturnType<typeof ok>>();
    api.obter.mockReturnValue(recarga);
    api.aprovar.mockReturnValue(
      of(
        ok(
          pedido({
            situacao: 'aguardando_protecao_de_dados',
            etapaAtual: 'protecao_de_dados',
          }),
        ),
      ),
    );
    pagina.pedirConfirmacao('aprovar');
    await pagina.executar();
    await esperar(fixture);
    expect(pagina.carregando()).toBe(true);
    expect(pagina.podeDecidir()).toBe(false);
    expect(
      [...host.querySelectorAll('cfg-pedido-resumo button')].some(
        (b) => b.textContent?.trim() === 'Aprovar',
      ),
    ).toBe(false);
    recarga.next(
      ok(pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' })),
    );
    recarga.complete();
    await esperar(fixture);
    expect(pagina.podeDecidir()).toBe(false);
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
    const { pagina, fixture } = await abrir([], solicitadoPorMim());
    anexos.anexar.mockResolvedValue({ ok: true });

    await pagina.anexar(new File(['%PDF'], 'd.pdf', { type: 'application/pdf' }));
    await esperar(fixture);

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
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        provideHttpClient(
          withInterceptors([
            (req) =>
              (req.url.endsWith('/trilha')
                ? api.trilha(decodeURIComponent(req.url.split('/').at(-2) ?? ''))
                : api.obter(decodeURIComponent(req.url.split('/').at(-1) ?? ''))
              ).pipe(map((body: unknown) => new HttpResponse({ body }))),
          ]),
        ),
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
