import { EdicaoDoPedidoDeAcesso } from './edicao-do-pedido-de-acesso';
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
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFailure } from '@uniplus/shared-core/http';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { PedidosDeConcessaoApi } from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { AnexoDoPedidoService } from './anexo-do-pedido.service';
import { PedirAcessoPage } from './pedir-acesso.page';
import { ok, pedido, recusa, UNIDADES } from './testes';

const PERFIL_COMUM = {
  id: 'perfil-1',
  nome: 'Operador de inscrições',
  descricao: 'Opera as inscrições.',
  escopo: 'unidade',
  exigeAprovacaoDeProtecaoDeDados: false,
  governanca: null,
};
const PERFIL_INSTITUCIONAL = {
  ...PERFIL_COMUM,
  id: 'perfil-2',
  nome: 'Gestor de acessos',
  escopo: 'instituicao',
  exigeAprovacaoDeProtecaoDeDados: true,
};

const PERFIL_DE_GOVERNANCA = {
  ...PERFIL_INSTITUCIONAL,
  id: 'perfil-3',
  nome: 'Encarregado(a) pelo tratamento de dados',
  governanca: 'protecao-de-dados',
};

describe('PedirAcessoPage', async () => {
  const api = { criar: vi.fn(), perfisParaPedir: vi.fn() };
  const anexos = { anexar: vi.fn() };
  const notificacoes = { success: vi.fn(), warning: vi.fn() };

  async function montar() {
    api.perfisParaPedir.mockReturnValue(
      of(ok([PERFIL_COMUM, PERFIL_INSTITUCIONAL, PERFIL_DE_GOVERNANCA])),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        provideHttpClient(
          withInterceptors([
            (_req) =>
              api
                .perfisParaPedir({ cursor: undefined, direction: 'next', limit: 100 })
                .pipe(map((body: unknown) => new HttpResponse({ body }))),
          ]),
        ),
        provideRouter([]),
        { provide: PedidosDeConcessaoApi, useValue: api },
        { provide: AnexoDoPedidoService, useValue: anexos },
        { provide: NotificationService, useValue: notificacoes },
        { provide: UnidadesApi, useValue: { listar: () => of(ok(UNIDADES)) } },
      ],
    });
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PedirAcessoPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const campo = <T extends HTMLElement>(seletor: string) => host.querySelector(seletor) as T;
    const digitar = (seletor: string, valor: string) => {
      const el = campo<HTMLInputElement>(seletor);
      el.value = valor;
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input'));
      fixture.detectChanges();
    };
    const enviar = async () => {
      campo<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, host, digitar, enviar, navegar, campo };
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('mantém os valores e o foco durante o envio e recusa nova submissão', async () => {
    const resposta = new Subject<ReturnType<typeof ok<ReturnType<typeof pedido>>>>();
    api.criar.mockReturnValue(resposta);
    const { fixture, host, digitar, campo } = await montar();
    digitar('select[formcontrolname="perfilId"]', 'perfil-2');
    digitar('textarea[formcontrolname="justificativa"]', 'Preciso deste acesso para trabalhar.');
    const botao = campo<HTMLButtonElement>('button[type="submit"]');
    botao.focus();
    botao.click();
    fixture.detectChanges();

    const justificativa = campo<HTMLTextAreaElement>('textarea[formcontrolname="justificativa"]');
    expect(justificativa.matches(':disabled')).toBe(true);
    expect(justificativa.value).toBe('Preciso deste acesso para trabalhar.');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(botao);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Enviando pedido');
    botao.click();
    campo<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    expect(api.criar).toHaveBeenCalledTimes(1);

    resposta.next(ok(pedido()));
    resposta.complete();
    await fixture.whenStable();
  });

  it('apresenta a recusa no campo e leva o foco a ele', async () => {
    api.criar.mockReturnValue(
      of(
        apiFailure(
          {
            type: 'x',
            title: 'Dados inválidos',
            status: 422,
            code: 'validacao',
            traceId: '',
            errors: [
              { field: 'Justificativa', code: 'invalida', message: 'Justificativa recusada.' },
            ],
          },
          422,
          new HttpHeaders(),
        ),
      ),
    );
    const { fixture, digitar, enviar, campo, host } = await montar();
    digitar('select[formcontrolname="perfilId"]', 'perfil-2');
    digitar('textarea', 'Preciso deste acesso para trabalhar.');
    campo<HTMLButtonElement>('button[type="submit"]').focus();
    await enviar();
    await fixture.whenStable();
    const justificativa = campo<HTMLTextAreaElement>('textarea');
    expect(justificativa.getAttribute('aria-invalid')).toBe('true');
    expect(host.textContent).toContain('Justificativa recusada.');
    expect(document.activeElement).toBe(justificativa);
  });

  it('recusa chamadas concorrentes à classe de escrita', async () => {
    const resposta = new Subject<ReturnType<typeof ok<ReturnType<typeof pedido>>>>();
    api.criar.mockReturnValue(resposta);
    const { fixture, digitar } = await montar();
    digitar('select[formcontrolname="perfilId"]', 'perfil-2');
    digitar('textarea', 'Preciso deste acesso para trabalhar.');
    const edicao = fixture.debugElement.injector.get(EdicaoDoPedidoDeAcesso);
    const primeira = edicao.enviar();
    expect(edicao.enviando()).toBe(true);
    await edicao.enviar();
    expect(api.criar).toHaveBeenCalledTimes(1);
    resposta.next(ok(pedido()));
    resposta.complete();
    await primeira;
    expect(edicao.enviando()).toBe(false);
  });

  it('lista os perfis que a API oferece para pedir', async () => {
    const { host } = await montar();

    const opcoes = Array.from(
      host.querySelectorAll('select[formcontrolname="perfilId"] option'),
    ).map((o) => o.textContent?.trim());
    expect(opcoes).toEqual([
      'Selecione um perfil',
      'Operador de inscrições',
      'Gestor de acessos',
      'Encarregado(a) pelo tratamento de dados',
    ]);
    expect(host.querySelector('input[formcontrolname="perfilId"]')).toBeNull();
  });

  it('mostra a recusa da leitura dos perfis, sem pedir o código do perfil', async () => {
    api.perfisParaPedir.mockReturnValue(
      of(recusa('uniplus.autorizacao.pedido.solicitante_nao_institucional', 403)),
    );
    const fixture = await (async () => {
      TestBed.configureTestingModule({
        providers: [
          { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
          provideHttpClient(
            withInterceptors([
              (_req) =>
                api
                  .perfisParaPedir({ cursor: undefined, direction: 'next', limit: 100 })
                  .pipe(map((body: unknown) => new HttpResponse({ body }))),
            ]),
          ),
          provideRouter([]),
          { provide: PedidosDeConcessaoApi, useValue: api },
          { provide: AnexoDoPedidoService, useValue: anexos },
          { provide: NotificationService, useValue: notificacoes },
          { provide: UnidadesApi, useValue: { listar: () => of(ok(UNIDADES)) } },
        ],
      });
      const criado = TestBed.createComponent(PedirAcessoPage);
      criado.detectChanges();
      await criado.whenStable();
      criado.detectChanges();
      return criado;
    })();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).toContain('Não foi possível listar os perfis de acesso');
    expect(host.querySelector('select[formcontrolname="perfilId"]')).toBeNull();
    expect(host.querySelector('input[formcontrolname="perfilId"]')).toBeNull();
  });

  it('não envia o pedido incompleto', async () => {
    const { enviar, host } = await montar();

    await enviar();

    expect(api.criar).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Selecione o perfil.');
    expect(host.textContent).toContain('A justificativa deve ter de 10 a 2000 caracteres.');
  });

  it('liga cada mensagem de erro ao campo e leva o foco ao primeiro inválido', async () => {
    const { enviar, host, fixture } = await montar();

    await enviar();
    await fixture.whenStable();

    const perfil = host.querySelector('select[formcontrolname="perfilId"]') as HTMLElement;
    expect(perfil.getAttribute('aria-describedby')).toBe('cfg-pedir-perfilId-erro');
    expect(host.querySelector('#cfg-pedir-perfilId-erro')?.textContent).toContain('Selecione');
    const justificativa = host.querySelector('textarea') as HTMLElement;
    expect(justificativa.getAttribute('aria-describedby')).toBe('cfg-pedir-justificativa-erro');
    expect(document.activeElement).toBe(perfil);
  });

  describe('prazo sugerido', async () => {
    const preencher = (digitar: (s: string, v: string) => void) => {
      digitar('select[formcontrolname="perfilId"]', 'perfil-1');
      digitar('select[formcontrolname="unidadeId"]', 'unidade-1');
      digitar('textarea', 'Atendo a comissão do processo seletivo.');
    };

    it('não oferece o campo ao perfil de governança', async () => {
      const { digitar, campo } = await montar();
      expect(campo('input[formcontrolname="validaAteSugerida"]')).not.toBeNull();

      digitar('select[formcontrolname="perfilId"]', 'perfil-3');

      expect(campo('input[formcontrolname="validaAteSugerida"]')).toBeNull();
    });

    it('recusa data passada, liga o erro ao campo e não envia', async () => {
      const { digitar, enviar, campo, host } = await montar();
      preencher(digitar);
      digitar('input[formcontrolname="validaAteSugerida"]', '2020-01-01');

      await enviar();

      expect(api.criar).not.toHaveBeenCalled();
      expect(
        campo('input[formcontrolname="validaAteSugerida"]').getAttribute('aria-describedby'),
      ).toContain('cfg-pedir-validaAteSugerida-erro');
      expect(host.querySelector('#cfg-pedir-validaAteSugerida-erro')?.textContent).toContain(
        'já passou',
      );
    });

    it('envia o fim do dia escolhido, no fuso local e com deslocamento', async () => {
      api.criar.mockReturnValue(of(ok(pedido())));
      const { digitar, enviar } = await montar();
      preencher(digitar);
      digitar('input[formcontrolname="validaAteSugerida"]', '2099-06-15');

      await enviar();

      expect(api.criar.mock.calls[0]?.[0].validaAteSugerida).toMatch(
        /^2099-06-15T23:59:59[+-]\d{2}:\d{2}$/,
      );
    });

    it('sem prazo, o corpo não leva validaAteSugerida', async () => {
      api.criar.mockReturnValue(of(ok(pedido())));
      const { digitar, enviar } = await montar();
      preencher(digitar);

      await enviar();

      expect(api.criar.mock.calls[0]?.[0]).not.toHaveProperty('validaAteSugerida');
    });
  });

  it('bloqueia o envio de perfil de governança sem o PDF e liga a mensagem ao campo', async () => {
    const { digitar, enviar, host, fixture } = await montar();

    digitar('select[formcontrolname="perfilId"]', 'perfil-3');
    digitar('textarea', 'Designada para a proteção de dados da instituição.');
    await enviar();
    await fixture.whenStable();

    expect(api.criar).not.toHaveBeenCalled();
    expect(host.textContent).toContain('O documento de designação é obrigatório para este perfil.');
    const arquivo = host.querySelector('input[type="file"]') as HTMLElement;
    expect(arquivo.getAttribute('aria-invalid')).toBe('true');
    expect(arquivo.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('no perfil de governança sem PDF e com justificativa inválida, o foco fica na justificativa', async () => {
    const { digitar, enviar, host, fixture } = await montar();

    digitar('select[formcontrolname="perfilId"]', 'perfil-3');
    await enviar();
    await fixture.whenStable();

    expect(document.activeElement).toBe(host.querySelector('textarea'));
    expect(host.querySelector('label.is-required')?.textContent).toContain(
      'Documento de designação',
    );
  });

  it('envia o perfil de governança quando o PDF está anexado', async () => {
    api.criar.mockReturnValue(of(ok(pedido({ id: 'novo' }))));
    anexos.anexar.mockResolvedValue({ ok: true });
    const { digitar, enviar, fixture } = await montar();

    digitar('select[formcontrolname="perfilId"]', 'perfil-3');
    digitar('textarea', 'Designada para a proteção de dados da instituição.');
    fixture.debugElement.injector
      .get(EdicaoDoPedidoDeAcesso)
      .arquivo.set(new File(['%PDF'], 'portaria.pdf', { type: 'application/pdf' }));
    await enviar();

    expect(api.criar).toHaveBeenCalledTimes(1);
    expect(anexos.anexar).toHaveBeenCalled();
  });

  it('cria o pedido para si, na unidade escolhida, e abre o pedido criado', async () => {
    api.criar.mockReturnValue(of(ok(pedido({ id: 'novo' }))));
    const { digitar, enviar, navegar } = await montar();

    digitar('select[formcontrolname="perfilId"]', 'perfil-1');
    digitar('select[formcontrolname="unidadeId"]', 'unidade-1');
    digitar('textarea', 'Atendo a comissão do processo seletivo.');
    await enviar();

    expect(api.criar.mock.calls[0]?.[0]).toEqual({
      beneficiarioEmail: null,
      perfilId: 'perfil-1',
      unidadeId: 'unidade-1',
      justificativa: 'Atendo a comissão do processo seletivo.',
    });
    expect(anexos.anexar).not.toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith(['/acessos/pedidos', 'novo']);
  });

  it('pede o e-mail do beneficiário e dispensa a unidade no perfil institucional', async () => {
    api.criar.mockReturnValue(of(ok(pedido({ id: 'novo' }))));
    const { digitar, enviar, campo, host } = await montar();

    campo<HTMLInputElement>('input[value="outra"]').click();
    digitar('select[formcontrolname="perfilId"]', 'perfil-2');
    digitar('input[formcontrolname="beneficiarioEmail"]', 'betina.teste@unifesspa.edu.br');
    digitar('textarea', 'Designada como gestora de acessos.');
    await enviar();

    expect(host.querySelector('select[formcontrolname="unidadeId"]')).toBeNull();
    expect(api.criar.mock.calls[0]?.[0]).toMatchObject({
      beneficiarioEmail: 'betina.teste@unifesspa.edu.br',
      unidadeId: null,
    });
  });

  it('rejeita o e-mail inválido do beneficiário', async () => {
    const { digitar, enviar, campo, host } = await montar();

    campo<HTMLInputElement>('input[value="outra"]').click();
    digitar('select[formcontrolname="perfilId"]', 'perfil-1');
    digitar('select[formcontrolname="unidadeId"]', 'unidade-1');
    digitar('input[formcontrolname="beneficiarioEmail"]', 'sem-arroba');
    digitar('textarea', 'Atendo a comissão do processo seletivo.');
    await enviar();

    expect(api.criar).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Informe um e-mail válido.');
  });

  it('mostra a recusa da API e não segue para o pedido', async () => {
    api.criar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.pedido_duplicado', 409)));
    const { digitar, enviar, navegar, host } = await montar();

    digitar('select[formcontrolname="perfilId"]', 'perfil-1');
    digitar('select[formcontrolname="unidadeId"]', 'unidade-1');
    digitar('textarea', 'Atendo a comissão do processo seletivo.');
    await enviar();

    expect(host.textContent).toContain('Recusado');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('depois de falha de rede, repete o mesmo pedido sob a mesma chave e congela o formulário', async () => {
    api.criar
      .mockReturnValueOnce(of(recusa('uniplus.client.network_error', 0)))
      .mockReturnValueOnce(of(ok(pedido({ id: 'novo' }))));
    const { digitar, enviar, navegar, host, campo } = await montar();

    digitar('select[formcontrolname="perfilId"]', 'perfil-1');
    digitar('select[formcontrolname="unidadeId"]', 'unidade-1');
    digitar('textarea', 'Atendo a comissão do processo seletivo.');
    await enviar();

    expect(host.textContent).toContain('Não foi possível saber se o pedido foi registrado');
    expect(campo<HTMLTextAreaElement>('textarea').matches(':disabled')).toBe(true);
    await enviar();

    const [primeira, segunda] = api.criar.mock.calls;
    expect(segunda?.[0]).toEqual(primeira?.[0]);
    expect(segunda?.[1].get(IDEMPOTENCY_KEY_TOKEN)).toBe(primeira?.[1].get(IDEMPOTENCY_KEY_TOKEN));
    expect(navegar).toHaveBeenCalledWith(['/acessos/pedidos', 'novo']);
  });

  it('depois de recusa definitiva, o pedido corrigido sai sob chave nova', async () => {
    api.criar.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.pedido_duplicado', 409)));
    const { digitar, enviar } = await montar();

    digitar('select[formcontrolname="perfilId"]', 'perfil-1');
    digitar('select[formcontrolname="unidadeId"]', 'unidade-1');
    digitar('textarea', 'Atendo a comissão do processo seletivo.');
    await enviar();
    digitar('textarea', 'Atendo a comissão do processo seletivo 2027.');
    await enviar();

    const [primeira, segunda] = api.criar.mock.calls;
    expect(segunda?.[0].justificativa).toBe('Atendo a comissão do processo seletivo 2027.');
    expect(segunda?.[1].get(IDEMPOTENCY_KEY_TOKEN)).not.toBe(
      primeira?.[1].get(IDEMPOTENCY_KEY_TOKEN),
    );
  });

  it('depois de falha de rede seguida de recusa definitiva, reabilita o formulário e a próxima tentativa usa chave nova', async () => {
    api.criar
      .mockReturnValueOnce(of(recusa('uniplus.client.network_error', 0)))
      .mockReturnValueOnce(of(recusa('uniplus.autorizacao.pedido.pedido_duplicado', 409)))
      .mockReturnValueOnce(of(ok(pedido({ id: 'novo' }))));
    const { digitar, enviar, campo } = await montar();

    digitar('select[formcontrolname="perfilId"]', 'perfil-1');
    digitar('select[formcontrolname="unidadeId"]', 'unidade-1');
    digitar('textarea', 'Atendo a comissão do processo seletivo.');
    await enviar();
    expect(campo<HTMLTextAreaElement>('textarea').matches(':disabled')).toBe(true);
    await enviar();
    expect(campo<HTMLTextAreaElement>('textarea').matches(':disabled')).toBe(false);
    digitar('textarea', 'Atendo a comissão do processo seletivo 2027.');
    await enviar();

    const [primeira, , terceira] = api.criar.mock.calls;
    expect(terceira?.[1].get(IDEMPOTENCY_KEY_TOKEN)).not.toBe(
      primeira?.[1].get(IDEMPOTENCY_KEY_TOKEN),
    );
  });

  it('anexa o documento ao pedido criado e segue para ele', async () => {
    api.criar.mockReturnValue(of(ok(pedido({ id: 'novo' }))));
    anexos.anexar.mockResolvedValue({ ok: true });
    const { fixture, digitar, enviar, navegar } = await montar();
    const pdf = new File(['%PDF'], 'designacao.pdf', { type: 'application/pdf' });
    fixture.debugElement.injector.get(EdicaoDoPedidoDeAcesso).arquivo.set(pdf);

    digitar('select[formcontrolname="perfilId"]', 'perfil-1');
    digitar('select[formcontrolname="unidadeId"]', 'unidade-1');
    digitar('textarea', 'Atendo a comissão do processo seletivo.');
    await enviar();

    expect(anexos.anexar).toHaveBeenCalledWith('novo', pdf, expect.any(Function));
    expect(notificacoes.success).toHaveBeenCalledWith(
      'Pedido enviado',
      'O documento segue para verificação.',
    );
    expect(navegar).toHaveBeenCalled();
  });

  it('avisa quando o pedido nasce mas o documento falha', async () => {
    api.criar.mockReturnValue(of(ok(pedido({ id: 'novo' }))));
    anexos.anexar.mockResolvedValue({ ok: false, mensagem: 'Falha ao enviar o arquivo.' });
    const { fixture, digitar, enviar, navegar } = await montar();
    fixture.debugElement.injector
      .get(EdicaoDoPedidoDeAcesso)
      .arquivo.set(new File(['%PDF'], 'd.pdf', { type: 'application/pdf' }));

    digitar('select[formcontrolname="perfilId"]', 'perfil-1');
    digitar('select[formcontrolname="unidadeId"]', 'unidade-1');
    digitar('textarea', 'Atendo a comissão do processo seletivo.');
    await enviar();

    expect(notificacoes.warning).toHaveBeenCalledWith(
      'Pedido enviado, mas o documento não foi anexado',
      'Falha ao enviar o arquivo. Anexe-o pela página do pedido.',
    );
    expect(navegar).toHaveBeenCalledWith(['/acessos/pedidos', 'novo']);
  });

  it('segue para o pedido criado, sem erro de envio, quando o anexo lança exceção', async () => {
    api.criar.mockReturnValue(of(ok(pedido({ id: 'novo' }))));
    anexos.anexar.mockRejectedValue(new Error('rede'));
    const { fixture, digitar, enviar, navegar } = await montar();
    fixture.debugElement.injector
      .get(EdicaoDoPedidoDeAcesso)
      .arquivo.set(new File(['%PDF'], 'd.pdf', { type: 'application/pdf' }));

    digitar('select[formcontrolname="perfilId"]', 'perfil-1');
    digitar('select[formcontrolname="unidadeId"]', 'unidade-1');
    digitar('textarea', 'Atendo a comissão do processo seletivo.');
    await enviar();

    expect(notificacoes.warning).toHaveBeenCalledWith(
      'Pedido enviado, mas o documento não foi anexado',
      'Anexe-o pela página do pedido.',
    );
    expect(navegar).toHaveBeenCalledWith(['/acessos/pedidos', 'novo']);
  });
});
