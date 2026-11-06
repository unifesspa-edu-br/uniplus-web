import { TestRequest } from '@angular/common/http/testing';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ESCRITA,
  PaginaDeTeste,
  RES_750,
  RES_805,
  SEM_CORPO,
  linhas750,
  linhas805,
  recusa,
  indisponivel,
} from './pesos-enem.testing';

const TODAS = [...linhas805, ...linhas750];

describe('PesosEnemPage — remoção pela interface', () => {
  let t: PaginaDeTeste;
  let erros: ReturnType<typeof vi.spyOn>;
  let avisos: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    t = new PaginaDeTeste();
    const notificacoes = t.fixture.debugElement.injector.get(NotificationService);
    erros = vi.spyOn(notificacoes, 'errorFromProblem');
    avisos = vi.spyOn(notificacoes, 'warning');
    await t.carregarUmaPagina(TODAS);
  });
  afterEach(() => t.verificar());

  const remover = (resolucao: string): HTMLButtonElement =>
    t.elemento(`button[aria-label="Remover resolução ${resolucao}"]`);
  const confirmar = (): HTMLButtonElement =>
    t.elemento('cfg-confirmacao-de-remocao [data-testid="confirm-dialog-confirm"]');
  const cancelar = (): HTMLButtonElement =>
    t.elemento('cfg-confirmacao-de-remocao [data-testid="confirm-dialog-cancel"]');
  const dialogo = (): HTMLDialogElement => t.elemento('cfg-confirmacao-de-remocao dialog');
  const titulo = (): HTMLElement => t.elemento('#cfg-pesos-enem-titulo');

  async function confirmarRemocao(resolucao: string): Promise<TestRequest[]> {
    await t.acionar(remover(resolucao));
    await t.acionar(confirmar());
    return t.controller.match((r) => r.url.startsWith(`${ESCRITA}/`) && r.method === 'DELETE');
  }

  it('mantém o diálogo aberto, anuncia o andamento e deixa os acionadores indisponíveis', async () => {
    const envios = await confirmarRemocao(RES_805);

    expect(envios).toHaveLength(4);
    expect(t.gravacao.removendo()).toBe(true);
    expect(t.gravacao.salvandoEdicao()).toBe(false);
    expect(confirmar().getAttribute('aria-disabled')).toBe('true');
    expect(confirmar().getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(confirmar());
    expect(t.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
      `Removendo a resolução ${RES_805}.`,
    );
    for (const botao of [
      t.botao('Editar parâmetros'),
      remover(RES_750),
      t.botao('Cadastrar nova resolução'),
    ]) {
      expect(indisponivel(botao)).toBe(true);
      botao.click();
    }
    await t.propagar();
    expect(t.edicao.emEdicao()).toBeNull();
    expect(t.criacao.aberto()).toBe(false);

    envios.forEach((envio) => envio.flush(null, SEM_CORPO));
    await t.recarregarCom(linhas750);
  });

  it('não fecha por Cancelar, X nem Esc, e o segundo clique não envia', async () => {
    const envios = await confirmarRemocao(RES_805);

    expect(cancelar().matches(':disabled')).toBe(true);
    expect(
      dialogo().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled,
    ).toBe(true);
    dialogo().dispatchEvent(new Event('cancel', { cancelable: true }));
    confirmar().click();
    await t.propagar();

    expect(t.remocao.confirmando()).toBe(true);
    t.controller.expectNone((r) => r.method === 'DELETE');
    envios.forEach((envio) => envio.flush(null, SEM_CORPO));
    await t.recarregarCom(linhas750);
  });

  it('com a recarga atrasada, mantém as ações indisponíveis e, ao chegar sem o item, leva o foco ao título', async () => {
    const envios = await confirmarRemocao(RES_805);
    envios.forEach((envio) => envio.flush(null, SEM_CORPO));
    await t.propagar();

    expect(t.remocao.confirmando()).toBe(false);
    expect(t.gravacao.gravando()).toBe(true);
    expect(indisponivel(t.botao('Editar parâmetros'))).toBe(true);
    expect(t.raiz.textContent).toContain(`Pesos — ${RES_805}`);

    await t.recarregarCom(linhas750);
    await t.propagar();

    expect(t.raiz.textContent).not.toContain(`Pesos — ${RES_805}`);
    expect(t.gravacao.gravando()).toBe(false);
    expect(document.activeElement).toBe(titulo());
    expect(t.elemento('span.sr-only[role="status"]').textContent).toContain(
      `Resolução ${RES_805} removida.`,
    );
  });

  it('o 404 mantém o diálogo com a recusa, sem toast, e ao fechar o foco vai ao título', async () => {
    const envios = await confirmarRemocao(RES_805);
    envios.forEach((envio) =>
      envio.flush(...recusa(404, 'uniplus.configuracao.peso_area_enem.nao_encontrado')),
    );
    await t.propagar();

    expect(t.remocao.confirmando()).toBe(true);
    expect(dialogo().textContent).toContain('Falha');
    expect(t.elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
      'Não foi possível remover',
    );
    expect(erros).not.toHaveBeenCalled();
    // A recarga não apaga a recusa nem libera o botão enquanto não chega.
    expect(t.gravacao.gravando()).toBe(true);
    expect(confirmar().getAttribute('aria-disabled')).toBe('true');
    expect(dialogo().textContent).toContain('Falha');

    await t.recarregarCom(linhas750);
    await t.acionar(cancelar());
    await t.propagar();

    expect(t.remocao.confirmando()).toBe(false);
    expect(document.activeElement).toBe(titulo());
  });

  it('o 500 mantém o diálogo com a recusa e avisa por toast', async () => {
    const envios = await confirmarRemocao(RES_805);
    envios.forEach((envio) => envio.flush(...recusa(500, 'uniplus.internal.unexpected')));
    await t.propagar();

    expect(t.remocao.confirmando()).toBe(true);
    expect(dialogo().textContent).toContain('Falha');
    expect(erros).toHaveBeenCalledTimes(1);

    await t.recarregarCom(TODAS);
    expect(confirmar().getAttribute('aria-disabled')).toBeNull();
  });

  it('a falha parcial fecha o diálogo, avisa e recarrega', async () => {
    const envios = await confirmarRemocao(RES_805);
    envios[0]?.flush(...recusa(404, 'uniplus.configuracao.peso_area_enem.nao_encontrado'));
    envios.slice(1).forEach((envio) => envio.flush(null, SEM_CORPO));
    await t.propagar();

    expect(t.remocao.confirmando()).toBe(false);
    expect(avisos).toHaveBeenCalledTimes(1);
    expect(avisos.mock.calls[0]).toEqual([
      'Remoção parcial',
      '3 de 4 grupos foram removidos. Os demais não puderam ser removidos; confira a lista.',
    ]);
    expect(erros).not.toHaveBeenCalled();
    await t.recarregarCom([...linhas805.slice(0, 1), ...linhas750]);
  });

  it('a falha parcial devolve o foco ao botão de remover da resolução, que segue na lista', async () => {
    const envios = await confirmarRemocao(RES_805);
    envios[0]?.flush(...recusa(404, 'uniplus.configuracao.peso_area_enem.nao_encontrado'));
    envios.slice(1).forEach((envio) => envio.flush(null, SEM_CORPO));
    await t.propagar();
    await t.recarregarCom([...linhas805.slice(0, 1), ...linhas750]);
    await t.propagar();

    expect(document.activeElement).toBe(remover(RES_805));
  });

  it('a falha parcial leva o foco ao título quando a recarga já não traz a resolução', async () => {
    const envios = await confirmarRemocao(RES_805);
    envios[0]?.flush(...recusa(404, 'uniplus.configuracao.peso_area_enem.nao_encontrado'));
    envios.slice(1).forEach((envio) => envio.flush(null, SEM_CORPO));
    await t.propagar();
    await t.recarregarCom(linhas750);
    await t.propagar();

    expect(document.activeElement).toBe(titulo());
  });

  it('com 404 num grupo e 500 em outro, o aviso de erro sai pelo 500', async () => {
    const envios = await confirmarRemocao(RES_805);
    envios[0]?.flush(...recusa(404, 'uniplus.configuracao.peso_area_enem.nao_encontrado'));
    envios[1]?.flush(...recusa(500, 'uniplus.internal.unexpected'));
    envios.slice(2).forEach((envio) => envio.flush(null, SEM_CORPO));
    await t.propagar();

    expect(erros).toHaveBeenCalledTimes(1);
    expect(erros.mock.calls[0]?.[0]).toMatchObject({ status: 500 });
    expect(avisos.mock.calls[0]?.[1]).toContain('2 de 4 grupos foram removidos');
    await t.recarregarCom(linhas750);
  });

  it('a falha parcial por erro de servidor também avisa por toast de erro', async () => {
    const envios = await confirmarRemocao(RES_805);
    envios[0]?.flush(...recusa(500, 'uniplus.internal.unexpected'));
    envios.slice(1).forEach((envio) => envio.flush(null, SEM_CORPO));
    await t.propagar();

    expect(t.remocao.confirmando()).toBe(false);
    expect(avisos).toHaveBeenCalledTimes(1);
    expect(erros).toHaveBeenCalledTimes(1);
    await t.recarregarCom([...linhas805.slice(0, 1), ...linhas750]);
  });

  it('reconfirmar depois de a resolução sair da lista fecha o diálogo, limpa o alvo e leva o foco ao título', async () => {
    const envios = await confirmarRemocao(RES_805);
    envios.forEach((envio) =>
      envio.flush(...recusa(404, 'uniplus.configuracao.peso_area_enem.nao_encontrado')),
    );
    await t.propagar();
    await t.recarregarCom(linhas750);
    expect(t.remocao.confirmando()).toBe(true);
    expect(t.remocao.erro()).not.toBeNull();

    await t.acionar(confirmar());
    await t.propagar();

    expect(t.remocao.confirmando()).toBe(false);
    expect(t.remocao.resolucaoAlvo()).toBeNull();
    expect(t.remocao.erro()).toBeNull();
    expect(document.activeElement).toBe(titulo());
    t.controller.expectNone((r) => r.method === 'DELETE');
  });

  it('com a recarga falha, libera as ações e permite nova leitura', async () => {
    const envios = await confirmarRemocao(RES_805);
    envios.forEach((envio) => envio.flush(null, SEM_CORPO));
    await t.propagar();
    t.expectListagem().flush(...recusa(503, 'uniplus.internal.unexpected'));
    await t.propagar();

    expect(t.gravacao.gravando()).toBe(false);
    expect(document.activeElement).toBe(titulo());
    const tentar = t.elemento<HTMLButtonElement>('#cfg-pesos-enem-registros-tentar');
    expect(tentar.getAttribute('aria-disabled')).toBeNull();
    await t.acionar(tentar);
    await t.recarregarCom(linhas750);
    expect(t.store.mensagemDeErro()).toBeNull();
  });

  it('cancelar o pedido devolve o foco ao botão que abriu o diálogo', async () => {
    await t.acionar(remover(RES_805));
    await t.acionar(cancelar());
    await t.propagar();

    expect(t.remocao.confirmando()).toBe(false);
    expect(t.remocao.resolucaoAlvo()).toBeNull();
    expect(document.activeElement).toBe(remover(RES_805));
  });
});
