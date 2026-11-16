import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ESCRITA,
  abrirEdicao,
  botaoPorTexto,
  botaoSalvar,
  concluirRecarga,
  confirmarRemocao,
  elemento,
  falhaDoServidor,
  fase,
  montarPaginaComFase,
  propagarRenderizando,
  statusDaPagina,
} from './fases-canonicas.escritas.testing';
import { CenaDaPagina, URL_DA_LISTA } from './fases-canonicas.testing';

describe('FasesCanonicasPage — remoção pela interface', () => {
  let cena: CenaDaPagina;

  beforeEach(async () => {
    cena = await montarPaginaComFase();
  });

  afterEach(() => cena.controller.verify());

  it('remoção anuncia estado e recusa edição e remoção concorrentes', async () => {
    await confirmarRemocao(cena);
    const requisicao = cena.controller.expectOne(ESCRITA);
    expect(requisicao.request.method).toBe('DELETE');
    expect(cena.edicao.gravando()).toBe(true);
    expect(cena.edicao.salvando()).toBe(false);
    expect(elemento<HTMLFieldSetElement>(cena, '.form-drawer__campos').disabled).toBe(false);
    expect(botaoSalvar(cena).textContent).toContain('Salvar fase canônica');
    expect(elemento(cena, 'td[data-label="Código"]').textContent).toContain('Removendo...');
    const dialogo = elemento<HTMLDialogElement>(cena, 'cfg-confirmacao-de-remocao dialog');
    expect(dialogo.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagarRenderizando(cena);
    expect(cena.edicao.confirmando()).toBe(true);
    expect(elemento(cena, 'cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
      'Removendo a fase AVALIACAO.',
    );
    const editar = elemento<HTMLButtonElement>(
      cena,
      'button[aria-label="Editar fase canônica AVALIACAO"]',
    );
    expect(editar.disabled).toBe(true);
    editar.click();
    cena.edicao.abrirEdicao(fase);
    cena.edicao.salvar();
    cena.edicao.removerConfirmado();
    expect(cena.edicao.aberto()).toBe(false);
    cena.controller.expectNone(ESCRITA);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga(cena);
    expect(elemento(cena, 'span.sr-only[role="status"]').textContent).toContain(
      'Fase AVALIACAO removida.',
    );
  });

  it('mantém o rótulo da escrita na linha enquanto a lista recarrega', async () => {
    await confirmarRemocao(cena);
    cena.controller.expectOne(ESCRITA).flush(null, { status: 204, statusText: 'No Content' });
    await propagarRenderizando(cena);
    const recarga = cena.controller.expectOne((r) => r.url === URL_DA_LISTA);
    expect(elemento(cena, 'td[data-label="Código"]').textContent).toContain('Removendo...');
    expect(elemento(cena, 'td[data-label="Código"]').textContent).not.toContain('Salvando');
    recarga.flush([fase]);
    await propagarRenderizando(cena);
    expect(elemento(cena, 'td[data-label="Código"]').textContent).not.toContain('...');
  });

  it('não repete na página a falha da remoção depois de Cancelar', async () => {
    await confirmarRemocao(cena);
    cena.controller.expectOne(ESCRITA).flush(...falhaDoServidor());
    await propagarRenderizando(cena);
    const dialogo = elemento(cena, 'cfg-confirmacao-de-remocao dialog');
    expect(dialogo.querySelector('[role="status"]')?.textContent).toContain(
      'Não foi possível remover a fase AVALIACAO.',
    );
    expect(cena.edicao.confirmando()).toBe(true);
    const cancelar = [...dialogo.querySelectorAll('button')].find(
      (botao) => botao.textContent?.trim() === 'Cancelar',
    );
    cancelar?.click();
    await propagarRenderizando(cena);
    expect(cena.edicao.confirmando()).toBe(false);
    expect(statusDaPagina(cena)).toBe('');
  });

  it('abrir a edição apaga o desfecho anterior da página', async () => {
    await confirmarRemocao(cena);
    cena.controller.expectOne(ESCRITA).flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga(cena);
    expect(statusDaPagina(cena)).toContain('Fase AVALIACAO removida.');
    await abrirEdicao(cena);
    elemento<HTMLButtonElement>(cena, '.form-drawer__footer button').click();
    await propagarRenderizando(cena);
    expect(statusDaPagina(cena)).toBe('');
  });

  it('fecha o diálogo de remoção quando o navegador o fecha', async () => {
    elemento<HTMLButtonElement>(
      cena,
      'button[aria-label="Remover fase canônica AVALIACAO"]',
    ).click();
    await propagarRenderizando(cena);
    const dialogo = elemento<HTMLDialogElement>(cena, 'cfg-confirmacao-de-remocao dialog');
    dialogo.dispatchEvent(new Event('close'));
    await propagarRenderizando(cena);
    expect(cena.edicao.confirmando()).toBe(false);
  });

  it('a remoção pendente não deixa uma escrita concorrente tomar o andamento', async () => {
    cena.edicao.pedirRemocao(fase);
    cena.edicao.confirmando.set(false);
    cena.edicao.abrirEdicao(fase);
    cena.edicao.salvar();
    const salvamento = cena.controller.expectOne(ESCRITA);
    expect(cena.edicao.andamento()).toEqual({ id: 'f1', rotulo: 'Salvando...' });
    cena.edicao.removerConfirmado();
    cena.controller.expectNone(ESCRITA);
    expect(cena.edicao.andamento()).toEqual({ id: 'f1', rotulo: 'Salvando...' });
    expect(cena.edicao.anuncioDaRemocao()).toBe('');
    expect(cena.edicao.anuncioDoSalvamento()).toBe('Salvando fase canônica.');
    salvamento.flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga(cena);
  });

  it('clicar em Remover durante a remoção é recusado e não dispara outra requisição', async () => {
    await confirmarRemocao(cena);
    const requisicao = cena.controller.expectOne(ESCRITA);
    const clique = new MouseEvent('click', { bubbles: true, cancelable: true });
    elemento(cena, '[data-testid="confirm-dialog-confirm"]').dispatchEvent(clique);
    await propagarRenderizando(cena);
    expect(clique.defaultPrevented).toBe(true);
    cena.controller.expectNone(ESCRITA);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga(cena);
  });

  it('nova tentativa de remoção apaga a falha anterior', async () => {
    await confirmarRemocao(cena);
    cena.controller.expectOne(ESCRITA).flush(...falhaDoServidor());
    await propagarRenderizando(cena);
    expect(cena.edicao.erroRemocao()).not.toBeNull();
    cena.edicao.removerConfirmado();
    expect(cena.edicao.erroRemocao()).toBeNull();
    cena.controller.expectOne(ESCRITA).flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga(cena);
  });

  it('deixa indisponível "Tentar novamente" enquanto a remoção pende e a listagem falha', async () => {
    await confirmarRemocao(cena);
    const remocao = cena.controller.expectOne(ESCRITA);
    cena.store.recarregar();
    await propagarRenderizando(cena);
    cena.controller.expectOne((r) => r.url === URL_DA_LISTA).flush(...falhaDoServidor());
    await propagarRenderizando(cena);
    expect(botaoPorTexto(cena, 'Tentar novamente')?.getAttribute('aria-disabled')).toBe('true');
    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await concluirRecarga(cena);
  });
});
