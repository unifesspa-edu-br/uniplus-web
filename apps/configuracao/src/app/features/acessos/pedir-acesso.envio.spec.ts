import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import { EdicaoDoPedidoDeAcesso } from './edicao-do-pedido-de-acesso';
import { ok, pedido, recusa } from './testes';
import { dublesDoPedirAcesso, montarPedirAcesso } from './pedir-acesso.page.testing';

describe('PedirAcessoPage — prazo, governança e envio', () => {
  const dubles = dublesDoPedirAcesso();
  const { api, anexos, notificacoes } = dubles;
  const montar = (primeiraLeituraDosPerfis?: ReturnType<typeof recusa>) =>
    montarPedirAcesso(dubles, primeiraLeituraDosPerfis);

  beforeEach(() => {
    vi.resetAllMocks();
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

  it('mostra a recusa do perfil em janela de migração junto ao botão de enviar', async () => {
    api.criar.mockReturnValue(
      of(
        recusa(
          'uniplus.autorizacao.pedido.perfil_em_janela_de_migracao',
          422,
          'O perfil está em janela de migração.',
        ),
      ),
    );
    const { digitar, enviar, host } = await montar();

    digitar('select[formcontrolname="perfilId"]', 'perfil-1');
    digitar('select[formcontrolname="unidadeId"]', 'unidade-1');
    digitar('textarea', 'Atendo a comissão do processo seletivo.');
    await enviar();

    const formulario = host.querySelector('form') as HTMLFormElement;
    const alerta = formulario.querySelector('ui-alert');
    expect(alerta?.textContent).toContain('O perfil está em janela de migração.');
    expect(formulario.querySelector('button[type="submit"]')).not.toBeNull();
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
