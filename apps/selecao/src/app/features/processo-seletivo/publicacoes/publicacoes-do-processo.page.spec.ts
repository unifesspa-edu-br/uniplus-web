import { By } from '@angular/platform-browser';
import { StatusProcesso } from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicarDocumentoComponent } from './publicar-documento.component';
import {
  PaginaDePublicacoes,
  ROTA_ATOS,
  ROTA_PREVISTOS,
  ROTA_CAMPOS,
  ROTA_FASES,
  CAMPOS,
  FASES,
  ato,
  previstos,
  tick,
  temCorrigir,
} from './publicacoes-do-processo.page.testing';

describe('PublicacoesDoProcessoPage — atos publicados', () => {
  let pagina: PaginaDePublicacoes;

  beforeEach(() => {
    pagina = new PaginaDePublicacoes();
  });

  afterEach(() => pagina.controller.verify());

  it('liga a errata ao aviso e deixa de oferecer "Corrigir" no aviso original', async () => {
    const aviso = ato('aviso', { numero: '01/2026' });
    const errata = ato('errata', {
      tipoCodigo: 'ERRATA',
      tipoNome: 'Errata',
      atoCorrigidoId: 'aviso',
      motivoDaCorrecao: 'Corrige a data.',
    });

    await pagina.abrir(StatusProcesso.publicado, [errata, aviso]);

    const [linhaDaErrata, linhaDoAviso] = pagina.linhas();
    expect(linhaDaErrata.textContent).toContain('Corrige: Aviso nº 01/2026');
    expect(linhaDaErrata.textContent).toContain('Motivo: Corrige a data.');
    expect(temCorrigir(linhaDaErrata)).toBe(true);
    expect(linhaDoAviso.textContent).toContain('Corrigido por: Errata');
    expect(temCorrigir(linhaDoAviso)).toBe(false);
  });

  it('não oferece "Corrigir" no edital, que só se corrige por retificação', async () => {
    const edital = ato('edital', { tipoCodigo: 'EDITAL_ABERTURA', tipoNome: 'Edital de abertura' });

    await pagina.abrir(StatusProcesso.publicado, [edital]);

    expect(temCorrigir(pagina.linhas()[0])).toBe(false);
  });

  it('mostra a data do ato e o instante da publicação em colunas próprias, sem situação de registro', async () => {
    const publicado = ato('edital', {
      dataDoAto: '2026-11-10',
      publicadoEm: '2026-11-12T15:30:00Z',
    });

    await pagina.abrir(StatusProcesso.publicado, [publicado]);

    const cabecalhos = Array.from(pagina.host.querySelectorAll('th[scope="col"]')).map((th) =>
      th.textContent?.trim(),
    );
    const celulas = pagina.linhas()[0].querySelectorAll('td');
    expect(cabecalhos.slice(0, 3)).toEqual(['Documento', 'Data do ato', 'Publicado em']);
    expect(celulas[1].textContent?.trim()).toBe('10/11/2026');
    expect(celulas[2].textContent).toContain('12/11/2026');
    expect(celulas[2].textContent).toContain('12:30');
    expect(pagina.host.textContent).not.toMatch(/Em processamento|Registrado/);
  });

  it('abre o formulário de correção com o ato clicado', async () => {
    await pagina.abrir(StatusProcesso.publicado, [ato('aviso', { numero: '01/2026' })]);

    const corrigir = Array.from(pagina.linhas()[0].querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Corrigir',
    ) as HTMLButtonElement;
    corrigir.click();
    pagina.fixture.detectChanges();

    expect(pagina.fixture.componentInstance['modo']()).toEqual({
      tipo: 'correcao',
      ato: expect.objectContaining({ id: 'aviso' }),
    });
    expect(pagina.fixture.componentInstance['formularioAberto']()).toBe(true);
  });

  it('relê os atos quando o documento é publicado e mostra o novo na lista', async () => {
    await pagina.abrir(StatusProcesso.publicado, [ato('aviso', { numero: '01/2026' })]);
    expect(pagina.linhas()).toHaveLength(1);

    const formulario = pagina.fixture.debugElement.query(By.directive(PublicarDocumentoComponent));
    (formulario.componentInstance as PublicarDocumentoComponent).publicado.emit();

    const novo = ato('comunicado', { tipoCodigo: 'COMUNICADO', tipoNome: 'Comunicado' });
    pagina.controller.expectOne(ROTA_ATOS).flush([novo, ato('aviso', { numero: '01/2026' })]);
    pagina.responderPrevistos(previstos());
    await pagina.fixture.whenStable();
    pagina.fixture.detectChanges();

    expect(pagina.linhas()).toHaveLength(2);
    expect(pagina.linhas()[0].textContent).toContain('Comunicado');
  });

  it('sobe a espera dos atos ao relê-los, com a lista à vista, e a derruba junto da falha', async () => {
    await pagina.abrir(StatusProcesso.publicado, [ato('aviso', { numero: '01/2026' })]);
    const servico = pagina.fixture.componentInstance['publicacoes'];
    expect(servico.lendoAtos()).toBe(false);

    const formulario = pagina.fixture.debugElement.query(By.directive(PublicarDocumentoComponent));
    (formulario.componentInstance as PublicarDocumentoComponent).publicado.emit();

    expect(servico.lendoAtos()).toBe(true);
    expect(pagina.linhas()).toHaveLength(1);

    pagina.controller
      .expectOne(ROTA_ATOS)
      .flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Server Error' });
    pagina.responderPrevistos(previstos());
    await pagina.fixture.whenStable();
    pagina.fixture.detectChanges();

    expect(servico.lendoAtos()).toBe(false);
    expect(servico.atos().estado).toBe('falha');
  });

  it('com duas releituras dos atos seguidas, a resposta da mais antiga não derruba a espera nem sobrepõe a nova', async () => {
    await pagina.abrir(StatusProcesso.publicado, [ato('aviso', { numero: '01/2026' })]);
    const servico = pagina.fixture.componentInstance['publicacoes'];
    const formulario = pagina.fixture.debugElement.query(By.directive(PublicarDocumentoComponent));
    const publicado = (formulario.componentInstance as PublicarDocumentoComponent).publicado;

    publicado.emit();
    publicado.emit();
    const [antiga, nova] = pagina.controller.match(ROTA_ATOS);

    antiga.flush([ato('antigo')]);
    await tick();
    expect(servico.lendoAtos()).toBe(true);

    nova.flush([ato('novo')]);
    pagina.controller.match(ROTA_PREVISTOS).forEach((r) => r.flush(previstos()));
    pagina.controller.match(ROTA_CAMPOS).forEach((r) => r.flush(CAMPOS));
    pagina.controller.match((r) => r.url === ROTA_FASES).forEach((r) => r.flush(FASES));
    await tick();

    expect(servico.lendoAtos()).toBe(false);
    expect(servico.listaDeAtos().map((a) => a.id)).toEqual(['novo']);
  });

  it('oferece tentar de novo a falha dos atos e relê a lista ao tentar', async () => {
    await pagina.abrir(StatusProcesso.publicado, [ato('aviso', { numero: '01/2026' })]);
    const formulario = pagina.fixture.debugElement.query(By.directive(PublicarDocumentoComponent));
    (formulario.componentInstance as PublicarDocumentoComponent).publicado.emit();
    pagina.controller
      .expectOne(ROTA_ATOS)
      .flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Server Error' });
    pagina.responderPrevistos(previstos());
    await pagina.fixture.whenStable();
    pagina.fixture.detectChanges();

    const tentar = Array.from(pagina.host.querySelectorAll('button')).find(
      (b) =>
        b.textContent?.includes('Tentar novamente') &&
        b.closest('section')?.querySelector('#pub-page-atos-titulo'),
    );
    expect(tentar).toBeDefined();
    tentar?.click();
    await tick();
    pagina.controller.expectOne(ROTA_ATOS).flush([ato('aviso', { numero: '01/2026' })]);
    await pagina.fixture.whenStable();
    pagina.fixture.detectChanges();

    expect(pagina.linhas()).toHaveLength(1);
  });

  describe('abrir o documento publicado', () => {
    const abrirDocumento = (): void => {
      const botaoDoDocumento = pagina.host.querySelector<HTMLButtonElement>(
        'sel-arquivos-do-ato button',
      );
      botaoDoDocumento?.click();
    };

    afterEach(() => vi.restoreAllMocks());

    it('diz que o navegador bloqueou a aba, sem pedir o acesso', async () => {
      await pagina.abrir(StatusProcesso.publicado, [ato('aviso')]);
      vi.spyOn(window, 'open').mockReturnValue(null);

      abrirDocumento();
      await tick();
      pagina.fixture.detectChanges();

      expect(pagina.host.textContent).toContain('O navegador bloqueou a abertura do documento');
      pagina.controller.expectNone((r) => r.url.endsWith('/acesso'));
    });

    it('mostra a recusa do servidor ao pedir o acesso ao documento', async () => {
      await pagina.abrir(StatusProcesso.publicado, [ato('aviso')]);
      const aba = { close: vi.fn(), location: { href: '' }, opener: {} } as unknown as Window;
      vi.spyOn(window, 'open').mockReturnValue(aba);

      abrirDocumento();
      pagina.controller
        .expectOne((r) => r.url.endsWith('/documentos-a-publicar/doc-aviso/acesso'))
        .flush(
          { type: 'about:blank', title: 'Sem permissão para abrir o documento', status: 403 },
          { status: 403, statusText: 'Forbidden' },
        );
      await tick();
      pagina.fixture.detectChanges();

      expect(pagina.host.textContent).toContain('Não foi possível abrir o documento');
      expect(aba.close).toHaveBeenCalled();
    });
  });
});
