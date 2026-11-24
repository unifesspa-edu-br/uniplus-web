import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPO_LOCAL_DE_TESTE } from './locais-oferta.testing';
import {
  ENDERECO_RESOLVIDO,
  ESCRITA,
  LOCAL_DE_TESTE,
  PaginaDeLocais,
  carregarLista,
  clicarEmEditarLocal,
  clicarEmNovoLocal,
  montarPaginaIniciada,
  recusarCampoDoFormulario,
  responderLookupDeCampi,
  submeterFormulario,
} from './locais-oferta.pagina.testing';

describe('LocaisOfertaPage — gravação', () => {
  let pagina: PaginaDeLocais;

  beforeEach(() => {
    pagina = montarPaginaIniciada();
  });

  afterEach(() => pagina.controller.verify());

  const pedidoDeAtualizacao = () => pagina.controller.expectOne((r) => r.method === 'PUT');

  async function abrirEdicaoComEnderecoResolvido(): Promise<void> {
    await carregarLista(pagina, [LOCAL_DE_TESTE]);
    clicarEmEditarLocal(pagina);
    await responderLookupDeCampi(pagina);
    pagina.edicao.form.controls.endereco.setValue(ENDERECO_RESOLVIDO);
  }

  it('CA-04: cria local de oferta com tipo + endereço aninhado', async () => {
    await carregarLista(pagina, []);

    clicarEmNovoLocal(pagina);
    await responderLookupDeCampi(pagina);
    pagina.edicao.form.setValue({
      tipo: TIPO_LOCAL_DE_TESTE.codigo,
      codigoEmec: '999',
      campusResponsavelId: '',
      endereco: ENDERECO_RESOLVIDO,
    });

    submeterFormulario(pagina);

    const post = pagina.controller.expectOne(ESCRITA);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toMatchObject({
      tipo: TIPO_LOCAL_DE_TESTE.codigo,
      campusResponsavelId: null,
      cidadeCodigoIbge: '1504208',
      endereco: { cep: '68507590' },
    });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await pagina.propagar();
    await carregarLista(pagina, [LOCAL_DE_TESTE]);
    expect(pagina.edicao.formOpen()).toBe(false);
  });

  it('bloqueia ações durante a gravação e a recarga, liberando após receber a lista', async () => {
    const { edicao, propagar } = pagina;
    await abrirEdicaoComEnderecoResolvido();
    submeterFormulario(pagina);
    const escrita = pedidoDeAtualizacao();
    edicao.fechar();
    edicao.pedirRemocao(LOCAL_DE_TESTE);
    edicao.salvar();
    expect(edicao.formOpen()).toBe(true);
    expect(edicao.confirmOpen()).toBe(false);
    escrita.flush(null);
    await propagar();
    expect(edicao.gravando()).toBe(true);
    clicarEmNovoLocal(pagina);
    expect(edicao.formOpen()).toBe(false);
    await carregarLista(pagina, [LOCAL_DE_TESTE]);
    expect(edicao.gravando()).toBe(false);
    clicarEmNovoLocal(pagina);
    expect(edicao.formOpen()).toBe(true);
  });

  it('mantém ações indisponíveis e anuncia o salvamento dentro do drawer', async () => {
    const { edicao, fixture, propagar } = pagina;
    await abrirEdicaoComEnderecoResolvido();
    submeterFormulario(pagina);
    const escrita = pedidoDeAtualizacao();
    await propagar();
    const host = fixture.nativeElement as HTMLElement;
    const acao = host.querySelector<HTMLButtonElement>(
      'cfg-locais-oferta-lista button[aria-label^="Remover"]',
    );
    expect(acao?.disabled).toBe(true);
    expect(
      host.querySelector('cfg-local-oferta-formulario dialog p[role="status"]')?.textContent,
    ).toContain('Salvando');
    expect(
      host.querySelector('cfg-locais-oferta-lista td span[aria-hidden="true"]')?.textContent,
    ).toContain('Salvando');
    acao?.click();
    expect(edicao.confirmOpen()).toBe(false);
    escrita.flush(null);
    await propagar();
    await carregarLista(pagina, [LOCAL_DE_TESTE]);
  });

  it('marca o campo recusado pelo servidor e leva o foco até ele', async () => {
    await carregarLista(pagina, []);
    clicarEmNovoLocal(pagina);
    await responderLookupDeCampi(pagina);
    pagina.edicao.form.setValue({
      tipo: TIPO_LOCAL_DE_TESTE.codigo,
      codigoEmec: '999',
      campusResponsavelId: '',
      endereco: ENDERECO_RESOLVIDO,
    });
    const campo = pagina.elemento<HTMLInputElement>('input[formcontrolname="codigoEmec"]');
    const foco = vi.spyOn(campo, 'focus');
    submeterFormulario(pagina);
    await pagina.propagar();
    recusarCampoDoFormulario(
      pagina,
      'codigoEmec',
      'uniplus.configuracao.local.codigo_invalido',
      'Código inválido.',
    );
    await pagina.propagar();
    expect(campo.closest('label')?.textContent).toContain('Código inválido.');
    expect(foco).toHaveBeenCalled();
  });

  it('exige tipo e cidade — bloqueia salvar inválido', async () => {
    await carregarLista(pagina, []);
    clicarEmNovoLocal(pagina);
    await responderLookupDeCampi(pagina);
    // sem tipo nem cidade
    submeterFormulario(pagina);
    pagina.controller.expectNone(ESCRITA);
    expect(pagina.edicao.enderecoErro()).toContain('cidade');
  });

  it('não abre a edição com uma gravação em curso', async () => {
    const { edicao, propagar } = pagina;
    await abrirEdicaoComEnderecoResolvido();
    submeterFormulario(pagina);
    const escrita = pedidoDeAtualizacao();
    const iniciarCampi = vi.spyOn(pagina.store, 'iniciarCampi');
    edicao.fechar();
    clicarEmEditarLocal(pagina);
    expect(iniciarCampi).not.toHaveBeenCalled();
    expect(edicao.localEmEdicaoId()).toBe(LOCAL_DE_TESTE.id);
    escrita.flush(null);
    await propagar();
    await carregarLista(pagina, [LOCAL_DE_TESTE]);
  });
});
