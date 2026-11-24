import { ORIGENS_DE_DATA } from './origens-de-data.testing';
import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FasesCanonicasStore } from './fases-canonicas.store';
import {
  BASE,
  CRIAR_URL,
  CenaDaPagina,
  URL_DA_LISTA,
  faseAvaliacaoSeed,
  faseRecursoSeed,
  montarPagina,
  propagar,
  responderLista,
  urlRemocao,
  verificarRequisicoesDaPagina,
} from './fases-canonicas.testing';

describe('FasesCanonicasPage — edição pelo drawer', () => {
  let cena: CenaDaPagina;

  beforeEach(() => {
    cena = montarPagina();
  });

  afterEach(() => verificarRequisicoesDaPagina(cena));

  it('CA-05: o drawer só abre a partir da edição de uma fase existente', async () => {
    await responderLista(cena, [faseAvaliacaoSeed]);
    expect(cena.edicao.aberto()).toBe(false);

    cena.edicao.abrirEdicao(faseAvaliacaoSeed);
    expect(cena.edicao.aberto()).toBe(true);
    expect(cena.edicao.form.controls.codigo.value).toBe(faseAvaliacaoSeed.codigo);
  });

  it('CA-06: o drawer de edição usa título e ação compatíveis com a edição', async () => {
    await responderLista(cena, [faseAvaliacaoSeed]);
    cena.edicao.abrirEdicao(faseAvaliacaoSeed);
    cena.fixture.detectChanges();

    const texto: string = cena.fixture.nativeElement.textContent;
    expect(texto).toContain('Editar fase canônica');
    expect(texto).not.toContain('Nova fase canônica');

    const submit = cena.fixture.nativeElement.querySelector(
      'button[form="cfg-fase-canonica-form"]',
    ) as HTMLButtonElement;
    expect(submit.textContent?.trim()).toBe('Salvar fase canônica');
  });

  it('CA-07: código é readonly na edição e o payload de atualização não inclui o campo codigo', async () => {
    await responderLista(cena, [faseAvaliacaoSeed]);
    cena.edicao.abrirEdicao(faseAvaliacaoSeed);
    expect(cena.edicao.form.controls.codigo.value).toBe('AVALIACAO');
    cena.fixture.detectChanges();
    const codigoInput = cena.fixture.nativeElement.querySelector(
      '[formcontrolname="codigo"]',
    ) as HTMLInputElement;
    expect(codigoInput.readOnly).toBe(true);

    cena.edicao.form.controls.nome.setValue('Avaliação (revisada)');
    cena.edicao.salvar();

    const put = cena.controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseAvaliacaoSeed.id}`,
    );
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).not.toHaveProperty('codigo');
    expect(put.request.body).toMatchObject({
      id: faseAvaliacaoSeed.id,
      nome: 'Avaliação (revisada)',
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagar(cena);
    await responderLista(cena, [faseAvaliacaoSeed]);
  });

  it('CA-08/CA-14: salvar a edição emite PUT e nunca POST', async () => {
    await responderLista(cena, [faseAvaliacaoSeed]);
    cena.edicao.abrirEdicao(faseAvaliacaoSeed);
    cena.edicao.form.controls.nome.setValue('Avaliação (2)');
    cena.edicao.salvar();

    cena.controller.expectNone(CRIAR_URL);
    const put = cena.controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseAvaliacaoSeed.id}`,
    );
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagar(cena);
    await responderLista(cena, [faseAvaliacaoSeed]);
  });

  it('CA-05: grupos condicionais seguem o que a fase em edição admite', async () => {
    const faseHomologacao: FaseCanonicaDto = {
      ...faseAvaliacaoSeed,
      id: 'f-homolog',
      codigo: 'HOMOLOGACAO',
      agrupaEtapas: false,
      admiteAgruparEtapas: false,
      admiteComplementacao: true,
    };
    await responderLista(cena, [faseAvaliacaoSeed, faseHomologacao]);

    cena.edicao.abrirEdicao(faseAvaliacaoSeed);
    expect(cena.edicao.showGrupoAgrupa()).toBe(true);
    expect(cena.edicao.showGrupoCompl()).toBe(false);

    cena.edicao.abrirEdicao(faseHomologacao);
    expect(cena.edicao.showGrupoAgrupa()).toBe(false);
    expect(cena.edicao.showGrupoCompl()).toBe(true);
  });

  it('editar a fase de isenção deriva a marca de isenção e esconde a coleta de inscrição', async () => {
    const faseIsencao: FaseCanonicaDto = {
      ...faseAvaliacaoSeed,
      id: 'f-isencao',
      codigo: 'SOLICITACAO_ISENCAO',
      agrupaEtapas: false,
      coletaInscricao: false,
      coletaSolicitacaoIsencao: true,
    };
    await responderLista(cena, [faseIsencao]);

    cena.edicao.abrirEdicao(faseIsencao);
    cena.fixture.detectChanges();
    // O agregado exige a marca verdadeira nessa fase e recusa a coleta de
    // inscrição na mesma fase — as duas janelas são exclusivas.
    expect(cena.edicao.ehFaseDeIsencao()).toBe(true);
    expect(cena.edicao.form.controls.coletaSolicitacaoIsencao.value).toBe(true);
    expect(
      cena.fixture.nativeElement.querySelector('[formControlName="coletaInscricao"]'),
    ).toBeNull();

    cena.edicao.salvar();
    const put = cena.controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseIsencao.id}`,
    );
    expect(put.request.body).toMatchObject({
      coletaSolicitacaoIsencao: true,
      coletaInscricao: false,
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagar(cena);
    await responderLista(cena, [faseIsencao]);
  });

  it('CA-14: edição carrega os sinalizadores do DTO e os devolve na atualização', async () => {
    const faseComColeta: FaseCanonicaDto = {
      ...faseAvaliacaoSeed,
      coletaInscricao: true,
      origemData: ORIGENS_DE_DATA.NA_EXECUCAO,
    };
    await responderLista(cena, [faseComColeta]);

    cena.edicao.abrirEdicao(faseComColeta);
    expect(cena.edicao.form.controls.origemData.value).toBe(ORIGENS_DE_DATA.NA_EXECUCAO.codigo);
    expect(cena.edicao.form.controls.coletaInscricao.value).toBe(true);

    cena.edicao.salvar();
    const put = cena.controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseComColeta.id}`,
    );
    expect(put.request.body).toMatchObject({
      origemData: ORIGENS_DE_DATA.NA_EXECUCAO.codigo,
      coletaInscricao: true,
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagar(cena);
    await responderLista(cena, [faseComColeta]);
  });

  it('oferece a origem da data pelos rótulos novos, e a ajuda não cita terceiro, MEC nem SiSU', async () => {
    await responderLista(cena, [faseAvaliacaoSeed]);
    cena.edicao.abrirEdicao(faseAvaliacaoSeed);
    cena.fixture.detectChanges();

    const select: HTMLSelectElement = cena.fixture.nativeElement.querySelector(
      '[formControlName="origemData"]',
    );
    expect([...select.options].map((opcao) => opcao.text.trim())).toEqual([
      'Selecione a origem da data',
      ORIGENS_DE_DATA.NO_EDITAL.rotulo,
      ORIGENS_DE_DATA.NA_EXECUCAO.rotulo,
    ]);
    const ajuda = select.closest('label')?.querySelector('.field__hint')?.textContent ?? '';
    expect(ajuda).toContain('quando a data será definida');
    expect(ajuda).not.toMatch(/terceiro|MEC|SiSU/i);
  });

  it('bloqueia o formulário durante o envio e foca o campo recusado', async () => {
    await responderLista(cena, [faseAvaliacaoSeed]);
    cena.edicao.abrirEdicao(faseAvaliacaoSeed);
    cena.fixture.detectChanges();
    const form = cena.fixture.nativeElement.querySelector(
      '#cfg-fase-canonica-form',
    ) as HTMLFormElement;
    cena.edicao.salvar();
    cena.fixture.detectChanges();
    expect(form.querySelector('fieldset.form-drawer__campos:disabled')).not.toBeNull();
    expect(
      cena.fixture.nativeElement
        .querySelector('button[form="cfg-fase-canonica-form"]')
        .getAttribute('aria-disabled'),
    ).toBe('true');
    cena.edicao.fechar();
    expect(cena.edicao.aberto()).toBe(true);
    cena.edicao.salvar();
    cena.edicao.pedirRemocao(faseRecursoSeed);
    cena.controller.expectNone(urlRemocao(faseRecursoSeed));
    const requisicao = cena.controller.expectOne(urlRemocao(faseAvaliacaoSeed));
    requisicao.flush(
      {
        type: 'about:blank',
        status: 422,
        title: 'Recusa',
        code: 'uniplus.validacao',
        traceId: '00000000000000000000000000000001',
        errors: [
          {
            field: 'Nome',
            code: 'uniplus.configuracao.fase_canonica.invalida',
            message: 'Nome recusado.',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagar(cena);
    cena.fixture.detectChanges();
    await cena.fixture.whenStable();
    cena.fixture.detectChanges();
    const nome = form.querySelector('[formcontrolname="nome"]') as HTMLInputElement;
    expect(nome.getAttribute('aria-invalid')).toBe('true');
    expect(form.textContent).toContain('Nome recusado.');
    expect(document.activeElement).toBe(nome);
  });

  it('a recusa que ficou em um campo não impede corrigir o outro e reenviar', async () => {
    await responderLista(cena, [faseAvaliacaoSeed]);
    cena.edicao.abrirEdicao({ ...faseAvaliacaoSeed, coletaInscricao: true });
    cena.edicao.salvar();
    cena.controller.expectOne(urlRemocao(faseAvaliacaoSeed)).flush(
      {
        type: 'about:blank',
        status: 422,
        title: 'Recusa',
        code: 'uniplus.configuracao.fase_canonica.coleta_inscricao_e_isencao_mutuamente_exclusivas',
        traceId: '00000000000000000000000000000001',
        errors: [
          {
            field: 'coletaSolicitacaoIsencao',
            code: 'uniplus.configuracao.fase_canonica.coleta_inscricao_e_isencao_mutuamente_exclusivas',
            message: 'Uma fase não coleta inscrição e solicitação de isenção ao mesmo tempo.',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagar(cena);
    expect(cena.edicao.form.controls.coletaSolicitacaoIsencao.hasError('backend')).toBe(true);

    cena.edicao.form.controls.coletaInscricao.setValue(false);
    cena.edicao.salvar();

    cena.controller
      .expectOne(urlRemocao(faseAvaliacaoSeed))
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar(cena);
    expect(cena.edicao.aberto()).toBe(false);
    cena.controller.match((r) => r.url === URL_DA_LISTA);
  });

  it('libera as ações se a recarga falha e permite nova leitura', async () => {
    await responderLista(cena, [faseAvaliacaoSeed]);
    cena.edicao.abrirEdicao(faseAvaliacaoSeed);
    cena.edicao.form.controls.descricao.disable();
    cena.edicao.salvar();
    cena.controller
      .expectOne(urlRemocao(faseAvaliacaoSeed))
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar(cena);
    expect(cena.edicao.form.controls.descricao.disabled).toBe(true);
    cena.edicao.pedirRemocao(faseRecursoSeed);
    expect(cena.edicao.confirmando()).toBe(false);
    cena.controller
      .expectOne((r) => r.url === URL_DA_LISTA)
      .flush(
        {
          type: 'about:blank',
          title: 'Erro',
          status: 500,
          code: 'uniplus.erro',
          traceId: '00000000000000000000000000000001',
        },
        {
          status: 500,
          statusText: 'Server Error',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
    await propagar(cena);
    expect(cena.edicao.gravando()).toBe(false);
    cena.fixture.debugElement.injector.get(FasesCanonicasStore).tentarNovamente();
    await propagar(cena);
    await responderLista(cena, [faseAvaliacaoSeed]);
    expect(cena.edicao.gravando()).toBe(false);
  });
});
