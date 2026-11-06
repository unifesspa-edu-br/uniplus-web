import {
  HttpHeaders,
  HttpResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { map } from 'rxjs';
import { AUTORIZACAO_BASE_PATH } from '@uniplus/shared-data/autorizacao';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
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
import { PedidoDetalheStore } from './pedido-detalhe.store';
import { EU, concedidas, ok, pedido, recusa, UNIDADES } from './testes';

function presente<T>(valor: T | null | undefined): T {
  if (valor == null) throw new Error('elemento ausente');
  return valor;
}

const GESTOR = 'autorizacao:pedidos:aprovar-funcional';
const PROTECAO_DE_DADOS = 'autorizacao:pedidos:aprovar-protecao-de-dados';

async function esperar(fixture: { detectChanges(): void }): Promise<void> {
  await new Promise((resolver) => setTimeout(resolver));
  fixture.detectChanges();
}

type Cena = ComponentFixture<PedidoDetalhePage>;

const botao = (raiz: ParentNode | null, texto: string): HTMLButtonElement | undefined =>
  [...(raiz?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.trim() === texto);
const noResumo = (host: HTMLElement) => host.querySelector('cfg-pedido-resumo');
const dialogoDeConfirmacao = (host: HTMLElement) => host.querySelector(':scope > ui-dialog');
const dialogoDeMotivo = (host: HTMLElement) => host.querySelector('cfg-motivo-dialog');
const edicaoDe = (fixture: Cena) => fixture.debugElement.injector.get(EdicaoDoPedido);

async function clicar(fixture: Cena, elemento: HTMLElement | null | undefined): Promise<void> {
  presente(elemento).click();
  await esperar(fixture);
}

const decidirNoResumo = (fixture: Cena, host: HTMLElement, texto: string) =>
  clicar(fixture, botao(noResumo(host), texto));

const botaoDeConfirmacao = (host: HTMLElement) =>
  presente(
    dialogoDeConfirmacao(host)?.querySelector<HTMLButtonElement>(
      '.uni-dialog__footer .btn--primary, .uni-dialog__footer .btn--danger',
    ),
  );

const confirmarNoDialogo = (fixture: Cena, host: HTMLElement) =>
  clicar(fixture, botaoDeConfirmacao(host));

const campoDoMotivo = (host: HTMLElement) =>
  host.querySelector<HTMLTextAreaElement>('cfg-motivo-dialog textarea');

async function escreverMotivo(fixture: Cena, host: HTMLElement, texto: string): Promise<void> {
  const campo = presente(campoDoMotivo(host));
  campo.value = texto;
  campo.dispatchEvent(new Event('input'));
  await esperar(fixture);
}

const confirmarRecusa = (fixture: Cena, host: HTMLElement) =>
  clicar(fixture, botao(dialogoDeMotivo(host), 'Recusar pedido'));

async function recusarComMotivo(fixture: Cena, host: HTMLElement, motivo: string): Promise<void> {
  await decidirNoResumo(fixture, host, 'Recusar');
  await escreverMotivo(fixture, host, motivo);
  await confirmarRecusa(fixture, host);
}

const decisoesOferecidas = (host: HTMLElement) =>
  ['Aprovar', 'Recusar'].map((texto) => botao(noResumo(host), texto) !== undefined);

const dialogoAberto = (host: HTMLElement, seletor: string) =>
  host.querySelector(`${seletor} dialog[open]`) !== null;

const dialogoMotivoAlerta = (host: HTMLElement) =>
  host.querySelector('cfg-motivo-dialog ui-alert')?.textContent ?? undefined;
const textoDoAlerta = (host: HTMLElement) => host.querySelector('ui-alert')?.textContent;

async function selecionarArquivo(fixture: Cena, host: HTMLElement, arquivo: File): Promise<void> {
  const seletor = presente(
    host.querySelector<HTMLInputElement>('cfg-pedido-documentos input[type="file"]'),
  );
  Object.defineProperty(seletor, 'files', { value: [arquivo], configurable: true });
  seletor.dispatchEvent(new Event('change'));
  await esperar(fixture);
}

const pdf = () => new File(['%PDF'], 'd.pdf', { type: 'application/pdf' });

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
  const notificacoes = { success: vi.fn(), errorFromProblem: vi.fn() };

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
    const { fixture, host } = await abrir([GESTOR]);
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

    expect(host.querySelector('ui-alert')).toBeNull();
    expect(host.textContent).toContain('Carregando o pedido');

    novaObter.next(ok(pedido({ id: 'novo', justificativa: 'Justificativa do novo.' })));
    novaObter.complete();
    await esperar(fixture);
    expect(host.textContent).not.toContain('Carregando o pedido');
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
    const { host } = await abrir([GESTOR]);

    expect(decisoesOferecidas(host)).toEqual([true, true]);
  });

  it('a proteção de dados não decide pedido que ainda aguarda o gestor', async () => {
    const { host } = await abrir([PROTECAO_DE_DADOS]);

    expect(decisoesOferecidas(host)).toEqual([false, false]);
  });

  it('a proteção de dados decide o pedido da etapa dela', async () => {
    const { host } = await abrir(
      [PROTECAO_DE_DADOS],
      pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' }),
    );

    expect(decisoesOferecidas(host)).toEqual([true, true]);
  });

  it('quem é parte do pedido não decide', async () => {
    const { host } = await abrir([GESTOR], solicitadoPorMim());
    expect(decisoesOferecidas(host)).toEqual([false, false]);

    const outra = await abrir(
      [GESTOR],
      pedido({ beneficiario: { email: EU.email.toUpperCase(), identidade: null, nome: null } }),
    );
    expect(decisoesOferecidas(outra.host)).toEqual([false, false]);
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

    const { host } = await abrir([GESTOR, PROTECAO_DE_DADOS], naEtapaDaProtecaoDeDados);
    expect(decisoesOferecidas(host)).toEqual([false, false]);

    const outro = await abrir(
      [GESTOR, PROTECAO_DE_DADOS],
      pedido({
        ...naEtapaDaProtecaoDeDados,
        decisoes: [{ ...decisao, decisor: { emissor: 'unifesspa', sub: 'sub-outro-gestor' } }],
      }),
    );
    expect(decisoesOferecidas(outro.host)).toEqual([true, true]);
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
    expect(decisoesOferecidas(gestor.host)).toEqual([true, true]);

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
    expect(decisoesOferecidas(protecaoDeDados.host)).toEqual([true, true]);

    const mesmoGestor = await abrir([GESTOR, PROTECAO_DE_DADOS], naEtapaDaProtecaoDeDados);
    expect(decisoesOferecidas(mesmoGestor.host)).toEqual([false, false]);
  });

  it('depois de recusa da API, recarrega o pedido e mostra a etapa que a API tem', async () => {
    const { host, fixture } = await abrir([GESTOR, PROTECAO_DE_DADOS]);
    api.aprovar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.perfil_alterado', 409)));
    api.obter.mockReturnValue(
      of(ok(pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' }))),
    );

    await decidirNoResumo(fixture, host, 'Aprovar');
    await confirmarNoDialogo(fixture, host);

    expect(api.obter).toHaveBeenCalledTimes(2);
    expect(edicaoDe(fixture).erro()).toBe('Recusado');
    expect(textoDoAlerta(host)).toContain('Recusado');
    expect(host.textContent).toContain('Encarregado(a) pelo tratamento de dados');
  });

  it('mantém a confirmação aberta e impede outra decisão durante o envio', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    const resposta = new Subject<ReturnType<typeof ok>>();
    api.aprovar.mockReturnValue(resposta);
    await decidirNoResumo(fixture, host, 'Aprovar');
    const dialogo = presente(dialogoDeConfirmacao(host));
    const confirmar = botaoDeConfirmacao(host);
    await clicar(fixture, confirmar);

    expect(confirmar.getAttribute('aria-busy')).toBe('true');
    expect(confirmar.getAttribute('aria-disabled')).toBe('true');
    expect(dialogo.querySelector('[role="status"]')?.textContent).toContain('Enviando');
    expect(botao(dialogo, 'Voltar')?.disabled).toBe(true);
    confirmar.click();
    expect(api.aprovar).toHaveBeenCalledTimes(1);

    resposta.next(ok(pedido()));
    resposta.complete();
    await esperar(fixture);
    expect(dialogo.querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it('fecha o diálogo de recusa quando o pedido já não está na etapa da pessoa', async () => {
    const { host, fixture } = await abrir([GESTOR]);
    document.body.append(host);
    await decidirNoResumo(fixture, host, 'Recusar');
    api.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.etapa_invalida')));
    api.obter.mockReturnValue(
      of(ok(pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' }))),
    );

    await escreverMotivo(fixture, host, 'Motivo.');
    await confirmarRecusa(fixture, host);

    expect(decisoesOferecidas(host)).toEqual([false, false]);
    expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(false);
    expect(edicaoDe(fixture).erro()).toBe('Recusado');
    expect(textoDoAlerta(host)).toContain('Recusado');
    await esperar(fixture);
    expect(document.activeElement).toBe(host.querySelector('#cfg-pedido-titulo'));
    host.remove();
  });

  it('fecha a confirmação quando a recarga traz outra etapa e leva o foco ao título', async () => {
    const { host, fixture } = await abrir([GESTOR]);
    document.body.append(host);
    await decidirNoResumo(fixture, host, 'Aprovar');
    expect(dialogoAberto(host, ':scope > ui-dialog')).toBe(true);
    api.obter.mockReturnValue(
      of(ok(pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' }))),
    );

    fixture.debugElement.injector.get(PedidoDetalheStore).recarregar();
    await esperar(fixture);
    await esperar(fixture);

    expect(dialogoAberto(host, ':scope > ui-dialog')).toBe(false);
    expect(document.activeElement).toBe(host.querySelector('#cfg-pedido-titulo'));
    host.remove();
  });

  it('bloqueia nova decisão após recusa da API até reavaliar o pedido recarregado', async () => {
    const { host, fixture } = await abrir([GESTOR]);
    const recarga = new Subject<ReturnType<typeof ok>>();
    api.obter.mockReturnValue(recarga);
    api.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.perfil_alterado')));
    await recusarComMotivo(fixture, host, 'Motivo');

    expect(host.textContent).toContain('Carregando o pedido');
    await confirmarRecusa(fixture, host);
    await decidirNoResumo(fixture, host, 'Aprovar');
    await confirmarNoDialogo(fixture, host);
    expect(api.recusar).toHaveBeenCalledTimes(1);
    expect(api.aprovar).not.toHaveBeenCalled();

    recarga.next(
      ok(pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' })),
    );
    recarga.complete();
    await esperar(fixture);
    expect(decisoesOferecidas(host)).toEqual([false, false]);
    expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(false);
    await confirmarRecusa(fixture, host);
    expect(api.recusar).toHaveBeenCalledTimes(1);
  });

  it('aprova e recarrega o pedido', async () => {
    const { host, fixture } = await abrir([GESTOR]);
    api.aprovar.mockReturnValue(of(ok(pedido({ situacao: 'aguardando_protecao_de_dados' }))));

    await decidirNoResumo(fixture, host, 'Aprovar');
    await confirmarNoDialogo(fixture, host);

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
      const { fixture, host } = await abrir(
        [GESTOR],
        pedido({ validaAteSugerida: '2099-06-15T15:00:00Z' }),
      );
      api.aprovar.mockReturnValue(of(ok(pedido({ situacao: 'aguardando_protecao_de_dados' }))));

      expect(campo(host)?.value).toBe('2099-06-15');
      await decidirNoResumo(fixture, host, 'Aprovar');
      await confirmarNoDialogo(fixture, host);

      expect(api.aprovar).toHaveBeenCalledWith(
        'pedido-1',
        expect.anything(),
        expect.stringMatching(/^2099-06-15T23:59:59[+-]\d{2}:\d{2}$/),
      );
    });

    it('o gestor limpa o prazo sugerido e aprova sem validaAte', async () => {
      const { fixture, host } = await abrir(
        [GESTOR],
        pedido({ validaAteSugerida: '2099-06-15T15:00:00Z' }),
      );
      api.aprovar.mockReturnValue(of(ok(pedido())));

      digitar(host, '');
      await decidirNoResumo(fixture, host, 'Aprovar');
      await confirmarNoDialogo(fixture, host);

      expect(api.aprovar).toHaveBeenCalledWith('pedido-1', expect.anything(), null);
    });

    it('não pré-preenche uma sugestão que já venceu', async () => {
      const { host } = await abrir([GESTOR], pedido({ validaAteSugerida: '2020-01-01T15:00:00Z' }));

      expect(campo(host)?.value).toBe('');
    });

    it('o erro e o aria-invalid somem quando o gestor corrige a data', async () => {
      const { host, fixture } = await abrir([GESTOR]);
      digitar(host, '2020-01-01');
      await decidirNoResumo(fixture, host, 'Aprovar');
      expect(campo(host)?.getAttribute('aria-invalid')).toBe('true');

      digitar(host, '2099-01-01');
      fixture.detectChanges();

      expect(campo(host)?.getAttribute('aria-invalid')).toBeNull();
      expect(host.querySelector('#cfg-pedido-prazo-erro')).toBeNull();
    });

    it('recusa data passada, liga o erro ao campo e não abre a confirmação', async () => {
      const { host, fixture } = await abrir([GESTOR]);

      digitar(host, '2020-01-01');
      await decidirNoResumo(fixture, host, 'Aprovar');

      expect(api.aprovar).not.toHaveBeenCalled();
      expect(campo(host)?.getAttribute('aria-describedby')).toContain('cfg-pedido-prazo-erro');
      expect(host.querySelector('#cfg-pedido-prazo-erro')?.textContent).toContain('já passou');
    });

    it('ao aprovar com prazo inválido, o resumo encaminha o foco ao campo', async () => {
      const { host, fixture } = await abrir([GESTOR]);
      digitar(host, '2020-01-01');
      const focar = vi.spyOn(presente(campo(host)), 'focus');

      await decidirNoResumo(fixture, host, 'Aprovar');

      expect(focar).toHaveBeenCalled();
      expect(campo(host)?.getAttribute('aria-invalid')).toBe('true');
      expect(api.aprovar).not.toHaveBeenCalled();
    });

    it('perfil que não admite prazo não mostra o campo e aprova sem validaAte', async () => {
      const { fixture, host } = await abrir([GESTOR], pedido({ admitePrazo: false }));
      api.aprovar.mockReturnValue(of(ok(pedido())));

      expect(campo(host)).toBeNull();
      await decidirNoResumo(fixture, host, 'Aprovar');
      await confirmarNoDialogo(fixture, host);

      expect(api.aprovar).toHaveBeenCalledWith('pedido-1', expect.anything(), null);
    });

    it('na etapa da proteção de dados não há campo, mas o prazo do gestor aparece', async () => {
      const { fixture, host } = await abrir(
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
      await decidirNoResumo(fixture, host, 'Aprovar');
      await confirmarNoDialogo(fixture, host);
      expect(api.aprovar).toHaveBeenCalledWith('pedido-1', expect.anything(), null);
    });
  });

  it('mostra a recusa de quem decide o pedido de que é parte e relê o pedido', async () => {
    const { host, fixture } = await abrir([GESTOR]);
    api.aprovar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.decisor_e_parte')));

    await decidirNoResumo(fixture, host, 'Aprovar');
    await confirmarNoDialogo(fixture, host);

    expect(edicaoDe(fixture).erro()).toBe('Recusado');
    expect(textoDoAlerta(host)).toContain('Recusado');
    expect(api.obter).toHaveBeenCalledTimes(2);
    expect(notificacoes.success).not.toHaveBeenCalled();
    expect(notificacoes.errorFromProblem).not.toHaveBeenCalled();
  });

  it('a falha de servidor da decisão vira notificação, sem aviso de sucesso', async () => {
    const { host, fixture } = await abrir([GESTOR]);
    api.aprovar.mockReturnValue(of(recusa('uniplus.erro_interno', 500, 'Erro interno')));

    await decidirNoResumo(fixture, host, 'Aprovar');
    await confirmarNoDialogo(fixture, host);

    expect(notificacoes.errorFromProblem).toHaveBeenCalledOnce();
    expect(notificacoes.errorFromProblem.mock.calls[0]?.[1]).toEqual({ title: 'Erro interno' });
    expect(notificacoes.success).not.toHaveBeenCalled();
  });

  describe('foco depois de uma decisão aceita', () => {
    const seguinte = () =>
      pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' });

    async function decidirComRecargaPendente(acao: 'aprovar' | 'recusar') {
      const aberta = await abrir([GESTOR]);
      const { fixture, host } = aberta;
      document.body.append(host);
      const recarga = new Subject<ReturnType<typeof ok>>();
      api.obter.mockReturnValue(recarga);
      api[acao].mockReturnValue(of(ok(seguinte())));
      presente(botao(noResumo(host), acao === 'aprovar' ? 'Aprovar' : 'Recusar')).focus();
      if (acao === 'aprovar') {
        await decidirNoResumo(fixture, host, 'Aprovar');
        await confirmarNoDialogo(fixture, host);
      } else {
        await recusarComMotivo(fixture, host, 'Sem necessidade funcional.');
      }
      return { ...aberta, recarga };
    }

    const concluirRecarga = async (cena: Awaited<ReturnType<typeof decidirComRecargaPendente>>) => {
      cena.recarga.next(ok(seguinte()));
      cena.recarga.complete();
      await esperar(cena.fixture);
      await esperar(cena.fixture);
    };

    it.each(['aprovar', 'recusar'] as const)(
      'depois de %s, terminada a recarga, o foco livre vai ao título do pedido',
      async (acao) => {
        const cena = await decidirComRecargaPendente(acao);
        const titulo = presente(cena.host.querySelector('#cfg-pedido-titulo'));
        expect(document.activeElement).not.toBe(titulo);

        await concluirRecarga(cena);

        expect(document.activeElement).toBe(titulo);
        cena.host.remove();
      },
    );

    it('não tira o foco de quem o levou a outro lugar durante a recarga', async () => {
      const cena = await decidirComRecargaPendente('aprovar');
      const voltar = presente(cena.host.querySelector<HTMLAnchorElement>('.page-header a'));
      voltar.focus();

      await concluirRecarga(cena);

      expect(document.activeElement).toBe(voltar);
      cena.host.remove();
    });

    it('terminada a devolução, uma nova carga não repete o foco no título', async () => {
      const cena = await decidirComRecargaPendente('aprovar');
      await concluirRecarga(cena);
      presente(cena.host.querySelector<HTMLAnchorElement>('.page-header a')).focus();
      (document.activeElement as HTMLElement).blur();

      api.obter.mockReturnValue(of(ok(pedido({ id: 'outro' }))));
      cena.fixture.componentRef.setInput('id', 'outro');
      await esperar(cena.fixture);
      await esperar(cena.fixture);

      expect(document.activeElement).toBe(document.body);
      cena.host.remove();
    });

    it('se a recarga da decisão falha, a decisão não leva o foco ao título numa carga posterior', async () => {
      const cena = await decidirComRecargaPendente('aprovar');
      cena.recarga.error(new Error('rede'));
      await esperar(cena.fixture);
      await esperar(cena.fixture);
      presente(cena.host.querySelector<HTMLAnchorElement>('.page-header a')).focus();
      (document.activeElement as HTMLElement).blur();

      api.obter.mockReturnValue(of(ok(pedido({ id: 'outro' }))));
      cena.fixture.componentRef.setInput('id', 'outro');
      await esperar(cena.fixture);
      await esperar(cena.fixture);

      expect(document.activeElement).toBe(document.body);
      cena.host.remove();
    });

    it('a decisão recusada pela API não leva o foco ao título', async () => {
      const { fixture, host } = await abrir([GESTOR]);
      document.body.append(host);
      api.aprovar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.decisor_e_parte')));
      presente(botao(noResumo(host), 'Aprovar')).focus();

      await decidirNoResumo(fixture, host, 'Aprovar');
      await confirmarNoDialogo(fixture, host);
      await esperar(fixture);

      expect(document.activeElement).not.toBe(host.querySelector('#cfg-pedido-titulo'));
      host.remove();
    });
  });

  it.each(['aprovar', 'recusar'] as const)(
    'fecha o diálogo de %s quando a recarga falha e permite tentar novamente',
    async (acao) => {
      const { fixture, host } = await abrir([GESTOR]);
      document.body.append(host);
      const recarga = new Subject<ReturnType<typeof ok>>();
      api.obter.mockReturnValue(recarga);
      api[acao].mockReturnValue(of(recusa('uniplus.autorizacao.pedido.situacao_invalida')));
      if (acao === 'aprovar') {
        await decidirNoResumo(fixture, host, 'Aprovar');
        await confirmarNoDialogo(fixture, host);
      } else {
        await recusarComMotivo(fixture, host, 'Motivo');
      }
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
      expect(dialogoAberto(host, 'ui-dialog')).toBe(false);
      expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(false);
      const mensagemDaFalha = presente(edicaoDe(fixture).erro());
      expect(textoDoAlerta(host)).toContain(mensagemDaFalha);
      expect(document.activeElement).toBe(tentar);
      const nova = new Subject<ReturnType<typeof ok>>();
      api.obter.mockReturnValue(nova);
      tentar?.click();
      await esperar(fixture);
      expect(api.obter).toHaveBeenCalledTimes(3);
      expect(host.querySelector('#tentar-pedido')).toBe(tentar);
      expect(tentar?.getAttribute('aria-disabled')).toBe('true');
      expect(tentar?.getAttribute('aria-busy')).toBe('true');
      expect(document.activeElement).toBe(tentar);
      tentar?.click();
      expect(api.obter).toHaveBeenCalledTimes(3);

      nova.next(ok(pedido()));
      nova.complete();
      await esperar(fixture);
      await esperar(fixture);
      expect(host.querySelector('#tentar-pedido')).toBeNull();
      expect(textoDoAlerta(host) ?? '').not.toContain(mensagemDaFalha);
      expect(document.activeElement).toBe(host.querySelector('#cfg-pedido-titulo'));
      host.remove();
    },
  );

  it('anuncia cada nova tentativa de carregar o pedido, também a segunda falha seguida', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    document.body.append(host);
    const anuncio = (): string =>
      host.querySelector('span.sr-only[role="status"]')?.textContent ?? '';
    api.obter.mockReturnValue(throwError(() => new Error('rede')));
    (fixture.componentInstance as unknown as { recarregar(): void }).recarregar();
    await esperar(fixture);
    await esperar(fixture);
    expect(anuncio()).toBe('Falha na leitura: pedido.');

    const tentar = host.querySelector<HTMLButtonElement>('#tentar-pedido');
    expect(tentar).not.toBeNull();
    for (let vez = 0; vez < 2; vez++) {
      const pendente = new Subject<ReturnType<typeof ok>>();
      api.obter.mockReturnValue(pendente);
      tentar?.click();
      await esperar(fixture);
      expect(anuncio()).toBe('Lendo pedido...');
      pendente.error(new Error('rede'));
      await esperar(fixture);
      await esperar(fixture);
      expect(anuncio()).toBe('Falha na leitura: pedido.');
    }
    host.remove();
  });

  it('ao reabrir a recusa limpa o motivo e a validação anterior', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    await recusarComMotivo(fixture, host, '');
    const campo = campoDoMotivo(host);
    expect(campo?.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(campo);
    await escreverMotivo(fixture, host, 'Motivo anterior');
    await clicar(fixture, botao(dialogoDeMotivo(host), 'Cancelar'));
    await decidirNoResumo(fixture, host, 'Recusar');
    expect(campo?.value).toBe('');
    expect(campo?.getAttribute('aria-invalid')).toBeNull();
  });

  it('impede decisões concorrentes e mantém o diálogo aberto durante o envio', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    const resposta = new Subject<ReturnType<typeof ok>>();
    api.recusar.mockReturnValue(resposta);
    await decidirNoResumo(fixture, host, 'Recusar');
    await escreverMotivo(fixture, host, 'Motivo');
    const edicao = edicaoDe(fixture);
    await confirmarRecusa(fixture, host);
    const campo = campoDoMotivo(host);
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
    expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(true);
    expect(api.recusar).toHaveBeenCalledTimes(1);
    expect(api.aprovar).not.toHaveBeenCalled();
    resposta.next(ok(pedido()));
    resposta.complete();
    await esperar(fixture);
    expect(edicao.recusando()).toBe(false);
    expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(false);
  });

  it('mostra e foca o motivo recusado pelo servidor', async () => {
    const { fixture, host } = await abrir([GESTOR]);
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
    await recusarComMotivo(fixture, host, 'Motivo');
    await esperar(fixture);
    const campo = campoDoMotivo(host);
    expect(campo?.getAttribute('aria-invalid')).toBe('true');
    expect(host.textContent).toContain('Motivo recusado.');
    expect(document.activeElement).toBe(campo);
  });

  it('confirmar de novo sem editar o motivo recusado volta a enviar a recusa à API', async () => {
    const { fixture, host } = await abrir([GESTOR]);
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
    await recusarComMotivo(fixture, host, 'Motivo');
    await esperar(fixture);

    await confirmarRecusa(fixture, host);

    expect(api.recusar).toHaveBeenCalledTimes(2);
  });

  it('recusa com motivo e fecha o diálogo', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    api.recusar.mockReturnValue(of(ok(pedido({ situacao: 'recusado', etapaAtual: null }))));

    await recusarComMotivo(fixture, host, 'Sem necessidade funcional.');

    expect(api.recusar.mock.calls[0]?.slice(0, 2)).toEqual([
      'pedido-1',
      'Sem necessidade funcional.',
    ]);
    expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(false);
  });

  it('mantém o diálogo de recusa com o erro da API', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    api.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.motivo_invalido')));

    await recusarComMotivo(fixture, host, 'x');

    expect(edicaoDe(fixture).erroDaRecusa()).toBe('Recusado');
    expect(dialogoMotivoAlerta(host)).toContain('Recusado');
    expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(true);
  });

  it('reabrir o diálogo de recusa não mostra o erro da tentativa anterior', async () => {
    const { fixture, host } = await abrir([GESTOR]);
    api.recusar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.motivo_invalido')));
    await recusarComMotivo(fixture, host, 'x');
    await clicar(fixture, botao(dialogoDeMotivo(host), 'Cancelar'));

    await decidirNoResumo(fixture, host, 'Recusar');

    expect(edicaoDe(fixture).erroDaRecusa()).toBeNull();
    expect(dialogoMotivoAlerta(host)).toBeUndefined();
    expect(dialogoAberto(host, 'cfg-motivo-dialog')).toBe(true);
  });

  it('aplica a decisão retornada enquanto a recarga está pendente', async () => {
    const { fixture, host } = await abrir([GESTOR]);
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
    await decidirNoResumo(fixture, host, 'Aprovar');
    await confirmarNoDialogo(fixture, host);
    expect(host.textContent).toContain('Carregando o pedido');
    expect(decisoesOferecidas(host)).toEqual([false, false]);
    recarga.next(
      ok(pedido({ situacao: 'aguardando_protecao_de_dados', etapaAtual: 'protecao_de_dados' })),
    );
    recarga.complete();
    await esperar(fixture);
    expect(decisoesOferecidas(host)).toEqual([false, false]);
  });

  it('o beneficiário nomeado aceita o pedido que espera por ele', async () => {
    const aguardando = pedido({
      situacao: 'aguardando_beneficiario',
      etapaAtual: null,
      beneficiario: { email: EU.email, identidade: null, nome: null },
    });
    const { fixture, host } = await abrir([], aguardando);
    api.aceitar.mockReturnValue(of(ok(pedido())));

    await decidirNoResumo(fixture, host, 'Aceitar o pedido');
    await confirmarNoDialogo(fixture, host);

    expect(api.aceitar).toHaveBeenCalled();
  });

  it('o solicitante cancela antes da primeira decisão e volta à lista', async () => {
    const { fixture, host, navegar } = await abrir([], solicitadoPorMim());
    api.cancelar.mockReturnValue(of(ok(undefined)));

    await decidirNoResumo(fixture, host, 'Cancelar o pedido');
    await confirmarNoDialogo(fixture, host);

    expect(navegar).toHaveBeenCalledWith(['/acessos/pedidos']);
    expect(notificacoes.success).toHaveBeenCalledWith('Pedido cancelado');
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
    expect(botao(noResumo(decidido.host), 'Cancelar o pedido')).toBeUndefined();
    expect(decidido.host.textContent).toContain('Dado pessoal');

    const encerrado = await abrir([], { ...solicitadoPorMim(), situacao: 'aprovado' });
    expect(botao(noResumo(encerrado.host), 'Cancelar o pedido')).toBeUndefined();
  });

  it('mostra a recusa do cancelamento sem sair da página', async () => {
    const { fixture, host, navegar } = await abrir([], solicitadoPorMim());
    api.cancelar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.situacao_invalida')));

    await decidirNoResumo(fixture, host, 'Cancelar o pedido');
    await confirmarNoDialogo(fixture, host);

    expect(edicaoDe(fixture).erro()).toBe('Recusado');
    expect(textoDoAlerta(host)).toContain('Recusado');
    expect(navegar).not.toHaveBeenCalled();
    expect(notificacoes.success).not.toHaveBeenCalled();
    expect(notificacoes.errorFromProblem).not.toHaveBeenCalled();
  });

  it('a falha de servidor do cancelamento vira notificação', async () => {
    const { fixture, host } = await abrir([], solicitadoPorMim());
    api.cancelar.mockReturnValue(of(recusa('uniplus.erro_interno', 500, 'Erro interno')));

    await decidirNoResumo(fixture, host, 'Cancelar o pedido');
    await confirmarNoDialogo(fixture, host);

    expect(notificacoes.errorFromProblem).toHaveBeenCalledOnce();
    expect(notificacoes.success).not.toHaveBeenCalled();
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
    const { fixture, host } = await abrir([], solicitadoPorMim());
    anexos.anexar.mockResolvedValue({ ok: true });

    await selecionarArquivo(fixture, host, pdf());

    expect(anexos.anexar).toHaveBeenCalled();
    expect(api.obter).toHaveBeenCalledTimes(2);
    expect(notificacoes.success).toHaveBeenCalledWith(
      'Documento enviado',
      'Ele segue para verificação.',
    );
  });

  it('libera o seletor de arquivo quando o envio do anexo falha com exceção', async () => {
    const { fixture, host } = await abrir([], solicitadoPorMim());
    anexos.anexar.mockRejectedValue(new Error('rede'));

    await selecionarArquivo(fixture, host, pdf());

    const documentos = presente(host.querySelector('cfg-pedido-documentos'));
    expect(documentos.querySelector<HTMLInputElement>('input[type="file"]')?.disabled).toBe(false);
    expect(documentos.textContent).not.toContain('Enviando o documento');
    expect(edicaoDe(fixture).anexando()).toBe(false);
    expect(documentos.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível concluir a operação',
    );
  });

  it('ignora o segundo clique em cancelar enquanto o primeiro está em andamento', async () => {
    const { fixture, host } = await abrir([], solicitadoPorMim());
    const resposta = new Subject<ReturnType<typeof ok>>();
    api.cancelar.mockReturnValue(resposta);

    await decidirNoResumo(fixture, host, 'Cancelar o pedido');
    await confirmarNoDialogo(fixture, host);
    await confirmarNoDialogo(fixture, host);
    resposta.next(ok(undefined));
    resposta.complete();
    await esperar(fixture);

    expect(api.cancelar).toHaveBeenCalledTimes(1);
    expect(botaoDeConfirmacao(host).getAttribute('aria-busy')).toBeNull();
  });

  it('libera a ação e mostra o erro quando o cancelamento falha com exceção', async () => {
    const { fixture, host } = await abrir([], solicitadoPorMim());
    api.cancelar.mockReturnValue(throwError(() => new Error('rede')));

    await decidirNoResumo(fixture, host, 'Cancelar o pedido');
    await confirmarNoDialogo(fixture, host);

    expect(botaoDeConfirmacao(host).getAttribute('aria-busy')).toBeNull();
    expect(edicaoDe(fixture).erro()).toContain('Não foi possível concluir a operação');
    expect(textoDoAlerta(host)).toContain('Não foi possível concluir a operação');
  });

  it('mostra a falha do anexo no próprio campo', async () => {
    const { fixture, host } = await abrir([], solicitadoPorMim());
    anexos.anexar.mockResolvedValue({ ok: false, mensagem: 'Falha ao enviar o arquivo.' });

    await selecionarArquivo(fixture, host, pdf());

    expect(edicaoDe(fixture).erroDoAnexo()).toBe('Falha ao enviar o arquivo.');
    expect(host.querySelector('cfg-pedido-documentos [role="alert"]')?.textContent).toContain(
      'Falha ao enviar o arquivo.',
    );
    expect(notificacoes.success).not.toHaveBeenCalled();
    expect(api.obter).toHaveBeenCalledTimes(1);
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
    const { fixture, host } = await abrir([GESTOR], comAnexo);
    anexos.abrir.mockResolvedValue('bloqueada');

    expect(host.textContent).toContain('Em verificação');
    expect(host.textContent?.match(/Abrir documento/gu)).toHaveLength(1);
    await clicar(fixture, botao(host, 'Abrir documento'));

    expect(anexos.abrir).toHaveBeenCalledWith('pedido-1', 'a1', expect.any(Function));
    expect(edicaoDe(fixture).erro()).toContain('bloqueou');
    expect(textoDoAlerta(host)).toContain('bloqueou');
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
