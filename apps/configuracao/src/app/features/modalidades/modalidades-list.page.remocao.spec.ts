import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PaginaDaListaDeModalidades, V } from './modalidades-list.page.testing';
import { AC, BASE, modalidade } from './modalidades-de-teste.testing';

describe('ModalidadesListPage', () => {
  let pagina: PaginaDaListaDeModalidades;

  beforeEach(() => {
    pagina = new PaginaDaListaDeModalidades();
  });

  afterEach(() => {
    pagina.verificar();
  });

  it('CA-04/CA-06: botão e diálogo falam em remover, não em inativar', async () => {
    await pagina.flushLista([AC, V]);
    pagina.fixture.detectChanges();
    const botao = pagina.fixture.nativeElement.querySelector(
      'button[aria-label="Remover modalidade V"]',
    ) as HTMLButtonElement | null;
    expect(botao?.getAttribute('data-tooltip')).toBe('Remover modalidade');

    pagina.component['pedirRemocao'](V);
    pagina.fixture.detectChanges();
    const dialogo = (
      Array.from(pagina.fixture.nativeElement.querySelectorAll('dialog')) as HTMLElement[]
    ).find((d) => d.textContent?.includes('soft-delete')) as HTMLElement;
    expect(dialogo.textContent).toContain('Remover modalidade');
    expect(dialogo.textContent).toContain('é removida (soft-delete)');
    expect(dialogo.textContent).not.toMatch(/inativ/i);
  });

  it('ModalidadeRemocaoDialog_BloqueiaQuandoReferenciada: sem DELETE quando há dependente', async () => {
    await pagina.flushLista([AC, V]);
    pagina.component['pedirRemocao'](AC);
    expect(pagina.component['remocaoBloqueada']()).toBe(true);
    pagina.component['removerConfirmado']();
    pagina.controller.expectNone(`${BASE}/api/configuracao/admin/modalidades/${AC.id}`);
  });

  it('ModalidadeRemocaoDialog_SoftDeleteQuandoLivre: DELETE e recarrega', async () => {
    await pagina.flushLista([AC, V]);
    pagina.component['pedirRemocao'](V);
    expect(pagina.component['remocaoBloqueada']()).toBe(false);
    pagina.component['removerConfirmado']();
    const req = pagina.controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${V.id}`);
    expect(pagina.component['removendo']()).toBe(true);
    pagina.component['removerConfirmado']();
    pagina.controller.expectNone(`${BASE}/api/configuracao/admin/modalidades/${V.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await pagina.propagate();
    expect(pagina.component['dialogAberto']()).toBe(false);
    expect(pagina.component['removendo']()).toBe(true);
    await pagina.flushLista([AC]);
    expect(pagina.component['removendo']()).toBe(false);
  });

  it('ModalidadeRemocaoDialog_409Servidor: 409 mantém bloqueio autoritativo', async () => {
    await pagina.flushLista([AC, V]);
    pagina.component['pedirRemocao'](V);
    pagina.component['removerConfirmado']();
    const req = pagina.controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${V.id}`);
    req.flush(
      {
        type: 'about:blank',
        title: 'Conflito',
        status: 409,
        code: 'Modalidade.RemocaoBloqueadaPorReferencia',
      },
      { status: 409, statusText: 'Conflict' },
    );
    await pagina.propagate();
    expect(pagina.component['bloqueioServidor']()).toBe(true);
    expect(pagina.component['remocaoBloqueada']()).toBe(true);
    // A mensagem do servidor é capturada para exibição quando o referente não está na página.
    expect(pagina.component['mensagemBloqueioServidor']()).toBeTruthy();
    await pagina.flushLista([AC, V]);
  });

  it('titula o bloqueio por referência com o título de referência', async () => {
    await pagina.flushLista([AC, V]);
    pagina.component['pedirRemocao'](V);
    pagina.component['removerConfirmado']();
    pagina.controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${V.id}`).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'Referenciada',
        status: 409,
        code: 'uniplus.configuracao.modalidade.remocao_bloqueada_por_referencia',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await pagina.propagate();
    pagina.fixture.detectChanges();
    expect(
      pagina.fixture.nativeElement.querySelector('dialog ui-alert[variant="warning"]')?.textContent,
    ).toContain('Modalidade referenciada por outra viva');
    await pagina.flushLista([AC, V]);
  });

  it('titula com o genérico o 409 que não é de referência', async () => {
    const livre = modalidade({ id: 'id-livre', codigo: 'LIVRE', descricao: 'Sem referência' });
    await pagina.flushLista([livre]);
    pagina.component['pedirRemocao'](livre);
    pagina.component['removerConfirmado']();
    pagina.controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${livre.id}`).flush(
      JSON.stringify({
        type: 'about:blank',
        title: 'A modalidade legal fixa não pode ser removida',
        status: 409,
        code: 'uniplus.configuracao.modalidade.remocao_bloqueada_codigo_protegido',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await pagina.propagate();
    pagina.fixture.detectChanges();
    expect(
      pagina.fixture.nativeElement.querySelector('dialog ui-alert[variant="warning"]')?.textContent,
    ).toContain('Não é possível remover');
    await pagina.flushLista([livre]);
  });

  it('mostra uma só vez a mensagem do 409 quando a referência está fora da página', async () => {
    const livre = modalidade({ id: 'id-livre', codigo: 'LIVRE', descricao: 'Sem referência' });
    await pagina.flushLista([livre]);
    pagina.component['pedirRemocao'](livre);
    pagina.component['removerConfirmado']();
    pagina.controller
      .expectOne(`${BASE}/api/configuracao/admin/modalidades/${livre.id}`)
      .flush(
        { type: 'about:blank', title: 'Conflito', status: 409, code: 'erro.conflito.remocao' },
        { status: 409, statusText: 'Conflict' },
      );
    await pagina.propagate();
    pagina.fixture.detectChanges();

    const mensagem = pagina.component['mensagemBloqueioServidor']() ?? '';
    const alertas = Array.from(
      pagina.fixture.nativeElement.querySelectorAll('dialog ui-alert'),
    ) as HTMLElement[];
    const ocorrencias = alertas.filter((alerta) => alerta.textContent?.includes(mensagem));
    expect(mensagem).not.toBe('');
    expect(ocorrencias).toHaveLength(1);
    expect(ocorrencias[0].textContent?.split(mensagem)).toHaveLength(2);
    await pagina.flushLista([livre]);
  });
});
