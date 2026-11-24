import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ESCRITA,
  LOCAL_DE_TESTE,
  PaginaDeLocais,
  abrirCadastroPreenchido,
  carregarLista,
  concluirCriacao,
  indisponivel,
  montarPaginaComListaCarregada,
  submeterFormulario,
} from './locais-oferta.pagina.testing';

describe('Envio do formulário de locais de oferta', () => {
  let pagina: PaginaDeLocais;

  beforeEach(async () => {
    pagina = await montarPaginaComListaCarregada();
  });
  afterEach(() => pagina.controller.verify());

  it('durante envio mantém foco, desabilita campos e bloqueia fechamento e novas ativações', async () => {
    const { edicao, elemento, propagar } = pagina;
    await abrirCadastroPreenchido(pagina);
    const salvar = elemento<HTMLButtonElement>('button[form="cfg-local-form"]');
    const chamada = vi.spyOn(edicao, 'salvar');
    salvar.focus();
    submeterFormulario(pagina);
    await propagar();
    expect(indisponivel(pagina, 'input[formcontrolname="codigoEmec"]')).toBe(true);
    expect(indisponivel(pagina, 'select[formcontrolname="tipo"]')).toBe(true);
    expect(indisponivel(pagina, 'select[formcontrolname="campusResponsavelId"]')).toBe(true);
    expect(elemento<HTMLInputElement>('input[formcontrolname="codigoEmec"]').value).toBe('999');
    expect(salvar.getAttribute('aria-disabled')).toBe('true');
    expect(salvar.getAttribute('aria-busy')).toBe('true');
    expect(salvar.textContent).toContain('Salvando');
    expect(document.activeElement).toBe(salvar);
    expect(elemento<HTMLButtonElement>('.form-drawer__footer button').disabled).toBe(true);
    const dialog = elemento<HTMLDialogElement>(
      'dialog[aria-label="Formulário de local de oferta"]',
    );
    expect(dialog.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled).toBe(
      true,
    );
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    salvar.click();
    submeterFormulario(pagina);
    await propagar();
    expect(edicao.formOpen()).toBe(true);
    expect(chamada).toHaveBeenCalledTimes(1);
    expect(elemento('dialog p[role="status"]').textContent).toContain('Salvando');
    await concluirCriacao(pagina);
  });

  it('com Enter num campo, leva o foco ao botão de salvar', async () => {
    const { elemento, propagar } = pagina;
    await abrirCadastroPreenchido(pagina);
    const campo = elemento<HTMLInputElement>('input[formcontrolname="codigoEmec"]');
    campo.focus();
    submeterFormulario(pagina);
    await propagar();
    expect(campo.matches(':disabled')).toBe(true);
    expect(document.activeElement).toBe(elemento('button[form="cfg-local-form"]'));
    await concluirCriacao(pagina);
  });

  it('recusa escritas concorrentes e mantém a trava até terminar a recarga', async () => {
    const { controller, edicao, propagar } = pagina;
    await abrirCadastroPreenchido(pagina);
    edicao.salvar();
    edicao.salvar();
    edicao.pedirRemocao(LOCAL_DE_TESTE);
    edicao.removerConfirmado();
    controller.expectNone(`${ESCRITA}/${LOCAL_DE_TESTE.id}`);
    controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    expect(edicao.gravando()).toBe(true);
    edicao.abrirCadastro();
    edicao.pedirRemocao(LOCAL_DE_TESTE);
    expect(edicao.formOpen()).toBe(false);
    expect(edicao.confirmOpen()).toBe(false);
    await carregarLista(pagina, [LOCAL_DE_TESTE]);
    expect(edicao.gravando()).toBe(false);
  });

  it('após sucesso preserva controle desabilitado e devolve foco ao acionador', async () => {
    const { controller, edicao, elemento, propagar } = pagina;
    const acionador = elemento<HTMLButtonElement>('.panel-head .btn--primary');
    acionador.focus();
    await abrirCadastroPreenchido(pagina);
    edicao.form.controls.campusResponsavelId.disable();
    elemento<HTMLButtonElement>('button[form="cfg-local-form"]').focus();
    edicao.salvar();
    controller.expectOne(ESCRITA).flush('id', { status: 201, statusText: 'Created' });
    await propagar();
    (document.activeElement as HTMLElement).blur();
    await carregarLista(pagina, [LOCAL_DE_TESTE]);
    await propagar();
    expect(indisponivel(pagina, 'select[formcontrolname="campusResponsavelId"]')).toBe(true);
    expect(indisponivel(pagina, 'input[formcontrolname="codigoEmec"]')).toBe(false);
    expect(document.activeElement).toBe(acionador);
  });
});
