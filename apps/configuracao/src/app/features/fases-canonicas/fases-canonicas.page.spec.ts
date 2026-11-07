import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FasesCanonicasPage } from './fases-canonicas.page';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { EdicaoDasFasesCanonicas } from './edicao-das-fases-canonicas';
import { FasesCanonicasStore } from './fases-canonicas.store';

const BASE = 'http://localhost:5000';
const CRIAR_URL = `${BASE}/api/configuracao/admin/fases-canonicas`;

const faseAvaliacaoSeed: FaseCanonicaDto = {
  id: '01960000-0000-7000-0000-0000000000f1',
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  descricao: null,
  unidadeSugerida: null,
  agrupaEtapas: true,
  permiteComplementacao: false,
  baseLegal: null,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  origemData: 'NO_EDITAL',
  criadoEm: '2026-06-10T12:00:00Z',
};

const faseRecursoSeed: FaseCanonicaDto = {
  ...faseAvaliacaoSeed,
  id: '01960000-0000-7000-0000-0000000000f2',
  codigo: 'RECURSO',
  nome: 'Recurso',
};

const urlRemocao = (fase: FaseCanonicaDto): string =>
  `${BASE}/api/configuracao/admin/fases-canonicas/${fase.id}`;

describe('FasesCanonicasPage', () => {
  let fixture: ComponentFixture<FasesCanonicasPage>;
  let store: FasesCanonicasStore;
  let edicao: EdicaoDasFasesCanonicas;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FasesCanonicasPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(FasesCanonicasPage);
    store = fixture.debugElement.injector.get(FasesCanonicasStore);
    edicao = fixture.debugElement.injector.get(EdicaoDasFasesCanonicas);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => {
    // A tela nunca deve emitir a criação de fase canônica.
    controller.expectNone((r) => r.method === 'POST' && r.url === CRIAR_URL);
    controller.verify();
  });

  const opcoesDaUnidade = (): string[] => {
    const opcoes: HTMLOptionElement[] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        'select[formControlName="unidadeSugeridaId"] option',
      ),
    );
    return opcoes.map((opcao) => opcao.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  };

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  async function flushLista(
    itens: readonly FaseCanonicaDto[],
    unidades: readonly unknown[] = [],
  ): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(itens);
    controller
      .match((r) => r.url === `${BASE}/api/organizacao/unidades`)
      .forEach((r) => r.flush(unidades));
    await propagate();
  }

  function nomesDeBotoes(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button')).map((b) =>
      ((b as HTMLButtonElement).textContent ?? '').trim().replace(/\s+/gu, ' '),
    );
  }

  it('CA-12: renderiza a lista de fases canônicas', async () => {
    await flushLista([faseAvaliacaoSeed]);
    expect(store.fases()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Avaliação');
    expect(fixture.nativeElement.textContent).toContain('AVALIACAO');
  });

  it('CA-01/CA-03: o cabeçalho não oferece a ação "Nova fase canônica"', async () => {
    await flushLista([faseAvaliacaoSeed]);
    fixture.detectChanges();
    const nomes = nomesDeBotoes();
    expect(nomes).not.toContain('Nova fase canônica');
    expect(nomes).not.toContain('Criar fase canônica');
  });

  it('CA-02/CA-16: o estado vazio informa sem sugerir cadastro da primeira fase', async () => {
    await flushLista([]);
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('catálogo de fases é definido institucionalmente');
    expect(texto).not.toMatch(/cadastr\w+ a primeira/iu);
    expect(nomesDeBotoes()).not.toContain('Nova fase canônica');
  });

  it('CA-10/CA-11: o aviso remete ao catálogo institucional e não orienta a criar uma nova entrada', async () => {
    await flushLista([]);
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Códigos definidos pelo catálogo institucional');
    expect(texto).not.toContain('crie uma nova entrada');
  });

  it('CA-13: a busca filtra os registros carregados pelo código', async () => {
    const faseMatricula: FaseCanonicaDto = { ...faseAvaliacaoSeed, id: 'f2', codigo: 'MATRICULA' };
    await flushLista([faseAvaliacaoSeed, faseMatricula]);

    store.termoBusca.set('matric');
    expect(store.fasesFiltradas()).toEqual([faseMatricula]);
  });

  it('navega pelo cursor e volta à primeira página ao recarregar', async () => {
    const primeira = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/fases-canonicas`,
    );
    primeira.flush([faseAvaliacaoSeed], {
      headers: {
        Link: '</api/configuracao/fases-canonicas?cursor=abc&direction=next>; rel="next"',
      },
    });
    controller
      .match((r) => r.url === `${BASE}/api/organizacao/unidades`)
      .forEach((r) => r.flush([]));
    await propagate();

    store.proximaPagina();
    await propagate();
    const segunda = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/fases-canonicas`,
    );
    expect(segunda.request.params.get('cursor')).toBe('abc');
    expect(segunda.request.params.get('direction')).toBe('next');
    segunda.flush([faseRecursoSeed]);
    await propagate();
    expect(store.fases()).toEqual([faseRecursoSeed]);

    store.recarregar();
    await propagate();
    const recarga = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/fases-canonicas`,
    );
    expect(recarga.request.params.get('limit')).toBe('50');
    expect(recarga.request.params.has('cursor')).toBe(false);
    recarga.flush([faseAvaliacaoSeed]);
    await propagate();
    expect(store.fases()).toEqual([faseAvaliacaoSeed]);
  });

  it('CA-05: o drawer só abre a partir da edição de uma fase existente', async () => {
    await flushLista([faseAvaliacaoSeed]);
    expect(edicao.aberto()).toBe(false);

    edicao.abrirEdicao(faseAvaliacaoSeed);
    expect(edicao.aberto()).toBe(true);
    expect(edicao.form.controls.codigo.value).toBe(faseAvaliacaoSeed.codigo);
  });

  it('CA-06: o drawer de edição usa título e ação compatíveis com a edição', async () => {
    await flushLista([faseAvaliacaoSeed]);
    edicao.abrirEdicao(faseAvaliacaoSeed);
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Editar fase canônica');
    expect(texto).not.toContain('Nova fase canônica');

    const submit = fixture.nativeElement.querySelector(
      'button[form="cfg-fase-canonica-form"]',
    ) as HTMLButtonElement;
    expect(submit.textContent?.trim()).toBe('Salvar fase canônica');
  });

  it('CA-07: código é readonly na edição e o payload de atualização não inclui o campo codigo', async () => {
    await flushLista([faseAvaliacaoSeed]);
    edicao.abrirEdicao(faseAvaliacaoSeed);
    expect(edicao.form.controls.codigo.value).toBe('AVALIACAO');
    fixture.detectChanges();
    const codigoInput = fixture.nativeElement.querySelector(
      '[formcontrolname="codigo"]',
    ) as HTMLInputElement;
    expect(codigoInput.readOnly).toBe(true);

    edicao.form.controls.nome.setValue('Avaliação (revisada)');
    edicao.salvar();

    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseAvaliacaoSeed.id}`,
    );
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).not.toHaveProperty('codigo');
    expect(put.request.body).toMatchObject({
      id: faseAvaliacaoSeed.id,
      nome: 'Avaliação (revisada)',
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([faseAvaliacaoSeed]);
  });

  it('CA-08/CA-14: salvar a edição emite PUT e nunca POST', async () => {
    await flushLista([faseAvaliacaoSeed]);
    edicao.abrirEdicao(faseAvaliacaoSeed);
    edicao.form.controls.nome.setValue('Avaliação (2)');
    edicao.salvar();

    controller.expectNone(CRIAR_URL);
    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseAvaliacaoSeed.id}`,
    );
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([faseAvaliacaoSeed]);
  });

  it('CA-05: grupos condicionais seguem o código da fase em edição', async () => {
    const faseHomologacao: FaseCanonicaDto = {
      ...faseAvaliacaoSeed,
      id: 'f-homolog',
      codigo: 'HOMOLOGACAO',
      agrupaEtapas: false,
    };
    await flushLista([faseAvaliacaoSeed, faseHomologacao]);

    edicao.abrirEdicao(faseAvaliacaoSeed);
    expect(edicao.showGrupoAgrupa()).toBe(true);
    expect(edicao.showGrupoCompl()).toBe(false);

    edicao.abrirEdicao(faseHomologacao);
    expect(edicao.showGrupoAgrupa()).toBe(false);
    expect(edicao.showGrupoCompl()).toBe(true);
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
    await flushLista([faseIsencao]);

    edicao.abrirEdicao(faseIsencao);
    fixture.detectChanges();
    // O agregado exige a marca verdadeira nessa fase e recusa a coleta de
    // inscrição na mesma fase — as duas janelas são exclusivas.
    expect(edicao.ehFaseDeIsencao()).toBe(true);
    expect(edicao.form.controls.coletaSolicitacaoIsencao.value).toBe(true);
    expect(fixture.nativeElement.querySelector('[formControlName="coletaInscricao"]')).toBeNull();

    edicao.salvar();
    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseIsencao.id}`,
    );
    expect(put.request.body).toMatchObject({
      coletaSolicitacaoIsencao: true,
      coletaInscricao: false,
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([faseIsencao]);
  });

  it('CA-14: edição carrega os sinalizadores do DTO e os devolve na atualização', async () => {
    const faseComColeta: FaseCanonicaDto = {
      ...faseAvaliacaoSeed,
      coletaInscricao: true,
      origemData: 'NA_EXECUCAO',
    };
    await flushLista([faseComColeta]);

    edicao.abrirEdicao(faseComColeta);
    expect(edicao.form.controls.origemData.value).toBe('NA_EXECUCAO');
    expect(edicao.form.controls.coletaInscricao.value).toBe(true);

    edicao.salvar();
    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseComColeta.id}`,
    );
    expect(put.request.body).toMatchObject({
      origemData: 'NA_EXECUCAO',
      coletaInscricao: true,
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([faseComColeta]);
  });

  it('oferece a origem da data pelos rótulos novos, e a ajuda não cita terceiro, MEC nem SiSU', async () => {
    await flushLista([faseAvaliacaoSeed]);
    edicao.abrirEdicao(faseAvaliacaoSeed);
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector(
      '[formControlName="origemData"]',
    );
    expect([...select.options].map((opcao) => opcao.text.trim())).toEqual([
      'Selecione a origem da data',
      'Fixada no edital',
      'Definida na execução',
    ]);
    const ajuda = select.closest('label')?.querySelector('.field__hint')?.textContent ?? '';
    expect(ajuda).toContain('Fixada no edital');
    expect(ajuda).not.toMatch(/terceiro|MEC|SiSU/i);
  });

  describe('unidade sugerida', () => {
    const CGA = {
      id: '01960000-0000-7000-0000-0000000000a2',
      sigla: 'CGA',
      nome: 'Centro de Gestão Acadêmica',
    };
    const comSugestao = (origemId = CGA.id): FaseCanonicaDto => ({
      ...faseAvaliacaoSeed,
      unidadeSugerida: { origemId, sigla: 'CGA', nome: CGA.nome },
    });
    const urlPut = (fase: FaseCanonicaDto) =>
      `${BASE}/api/configuracao/admin/fases-canonicas/${fase.id}`;

    async function salvarComSucesso(fase: FaseCanonicaDto): Promise<unknown> {
      edicao.salvar();
      const put = controller.expectOne(urlPut(fase));
      put.flush(null, { status: 204, statusText: 'No Content' });
      await propagate();
      await flushLista([fase], [CGA]);
      return put.request.body;
    }

    it('a lista mostra a sigla da unidade sugerida, ou "—" quando não há', async () => {
      await flushLista(
        [comSugestao(), { ...faseAvaliacaoSeed, id: 'f2', codigo: 'MATRICULA' }],
        [CGA],
      );
      fixture.detectChanges();

      const celulas = Array.from<HTMLElement>(
        fixture.nativeElement.querySelectorAll('td[data-label="Unidade sugerida"]'),
      ).map((celula) => celula.textContent?.replace(/\s+/g, ' ').trim());
      expect(celulas).toEqual(['CGA, Centro de Gestão Acadêmica', '—Sem unidade sugerida']);
    });

    it('escolher a unidade no campo a leva ao comando de atualização', async () => {
      await flushLista([faseAvaliacaoSeed], [CGA]);
      edicao.abrirEdicao(faseAvaliacaoSeed);
      edicao.form.controls.unidadeSugeridaId.setValue(CGA.id);

      expect(await salvarComSucesso(faseAvaliacaoSeed)).toMatchObject({
        unidadeSugeridaId: CGA.id,
      });
    });

    it('limpar a unidade sugerida envia nulo, que retira a sugestão', async () => {
      const fase = comSugestao();
      await flushLista([fase], [CGA]);
      edicao.abrirEdicao(fase);
      edicao.form.controls.unidadeSugeridaId.setValue('');

      expect(await salvarComSucesso(fase)).toMatchObject({ unidadeSugeridaId: null });
    });

    it('a unidade gravada fora das ativas continua como opção, marcada "(removida do cadastro)"', async () => {
      const fase = comSugestao('01960000-0000-7000-0000-0000000000a9');
      await flushLista([fase], [CGA]);
      edicao.abrirEdicao(fase);

      const [primeira] = edicao.unidadesParaEscolha();
      expect(primeira).toMatchObject({
        rotulo: 'CGA — Centro de Gestão Acadêmica',
        removida: true,
      });
      expect(edicao.form.controls.unidadeSugeridaId.value).toBe(fase.unidadeSugerida?.origemId);
      await propagate();
      expect(opcoesDaUnidade()).toContain(
        'CGA — Centro de Gestão Acadêmica (removida do cadastro)',
      );
    });

    it('não afirma que a unidade está removida quando o cadastro de unidades não carregou', async () => {
      const fase = comSugestao();
      const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`);
      req.flush([fase]);
      controller
        .match((r) => r.url === `${BASE}/api/organizacao/unidades`)
        .forEach((r) => r.flush(null, { status: 500, statusText: 'Server Error' }));
      await propagate();
      edicao.abrirEdicao(fase);

      expect(edicao.unidadesParaEscolha()[0]?.removida).toBe(false);
      await propagate();
      expect(opcoesDaUnidade().join()).not.toContain('(removida do cadastro)');
    });

    it('a nova tentativa das unidades que dá certo leva o foco ao campo Unidade sugerida', async () => {
      const fase = comSugestao();
      controller
        .expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`)
        .flush([fase]);
      controller
        .match((r) => r.url === `${BASE}/api/organizacao/unidades`)
        .forEach((r) => r.flush(null, { status: 500, statusText: 'Server Error' }));
      await propagate();
      edicao.abrirEdicao(fase);
      await propagate();
      const tentar = (): HTMLButtonElement | null =>
        (fixture.nativeElement as HTMLElement).querySelector('button.link-button');

      tentar()?.focus();
      tentar()?.click();
      await propagate();

      controller.expectOne((r) => r.url === `${BASE}/api/organizacao/unidades`).flush([CGA]);
      await propagate();
      await propagate();

      expect(tentar()).toBeNull();
      expect(document.activeElement).toBe(
        (fixture.nativeElement as HTMLElement).querySelector(
          'select[formControlName="unidadeSugeridaId"]',
        ),
      );
    });

    it('a recusa por unidade inexistente ou removida aparece no campo', async () => {
      await flushLista([faseAvaliacaoSeed], [CGA]);
      edicao.abrirEdicao(faseAvaliacaoSeed);
      edicao.form.controls.unidadeSugeridaId.setValue(CGA.id);

      edicao.salvar();
      controller.expectOne(urlPut(faseAvaliacaoSeed)).flush(
        {
          type: 'about:blank',
          title: 'Validação',
          status: 422,
          code: 'uniplus.validacao',
          traceId: '00000000000000000000000000000001',
          errors: [
            {
              field: 'unidadeSugeridaId',
              code: 'uniplus.configuracao.fase_canonica.unidade_sugerida_nao_encontrada',
              message: 'A unidade sugerida não está entre as unidades ativas.',
            },
          ],
        },
        {
          status: 422,
          statusText: 'Unprocessable Content',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
      await propagate();
      fixture.detectChanges();

      expect(mensagemDeErroDoControle(edicao.form.controls.unidadeSugeridaId)).toBe(
        'A unidade sugerida não está entre as unidades ativas.',
      );
      expect(
        fixture.nativeElement
          .querySelector('[formControlName="unidadeSugeridaId"]')
          ?.getAttribute('aria-invalid'),
      ).toBe('true');
    });
  });

  it('CA-10: aviso de código do catálogo é visível mesmo com lista vazia', async () => {
    await flushLista([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Códigos definidos pelo catálogo institucional',
    );
  });

  it('CA-08/CA-09/CA-10: remove uma fase canônica após confirmação e recarrega a lista', async () => {
    const sucessoSpy = vi.spyOn(TestBed.inject(NotificationService), 'success');
    await flushLista([faseAvaliacaoSeed]);
    edicao.pedirRemocao(faseAvaliacaoSeed);
    edicao.removerConfirmado();

    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseAvaliacaoSeed.id}`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
    expect(sucessoSpy).toHaveBeenCalledWith('Fase canônica removida', 'AVALIACAO');
  });

  it('CA-01/CA-03/CA-04/CA-05/CA-06/CA-07: lixeira e confirmação falam em remover e identificam a fase', async () => {
    await flushLista([faseAvaliacaoSeed]);
    fixture.detectChanges();
    const lixeira = fixture.nativeElement.querySelector(
      'button[aria-label="Remover fase canônica AVALIACAO"]',
    ) as HTMLButtonElement;
    expect(lixeira.getAttribute('data-tooltip')).toBe('Remover fase canônica');
    expect(lixeira.querySelector('.pi-trash')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-label^="Inativar"]')).toBeNull();

    lixeira.click();
    fixture.detectChanges();
    const dialogo = fixture.nativeElement.querySelector(
      'cfg-confirmacao-de-remocao',
    ) as HTMLElement;
    expect(dialogo.querySelector('h3')?.textContent?.trim()).toBe('Remover fase canônica');
    expect(dialogo.querySelector('.uni-dialog__body')?.textContent).toContain(
      'Deseja remover a fase AVALIACAO?',
    );
    expect(
      dialogo.querySelector('[data-testid="confirm-dialog-confirm"]')?.textContent?.trim(),
    ).toBe('Remover');
    expect(dialogo.textContent).not.toMatch(/inativ/iu);
  });

  it('CA-11: falha 4xx na remoção não notifica o servidor e mantém a lista', async () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    await flushLista([faseAvaliacaoSeed]);
    edicao.pedirRemocao(faseAvaliacaoSeed);
    edicao.removerConfirmado();

    controller.expectOne(urlRemocao(faseAvaliacaoSeed)).flush(
      {
        type: 'about:blank',
        title: 'Fase canônica não encontrada',
        status: 404,
        code: 'uniplus.configuracao.fase_canonica.nao_encontrada',
      },
      {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(erroSpy).not.toHaveBeenCalled();
    expect(edicao.removendo()).toBe(false);
    controller.expectNone((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`);
  });

  it('CA-11: falha 5xx na remoção notifica o servidor com o título resolvido', async () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    await flushLista([faseAvaliacaoSeed]);
    edicao.pedirRemocao(faseAvaliacaoSeed);
    edicao.removerConfirmado();

    controller.expectOne(urlRemocao(faseAvaliacaoSeed)).flush(
      {
        type: 'about:blank',
        title: 'Erro interno',
        status: 500,
        code: 'uniplus.erro_interno',
      },
      {
        status: 500,
        statusText: 'Server Error',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(erroSpy).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status: 500 }), {
      title: expect.any(String),
    });
  });

  it('CA-12: impede remoções concorrentes e mantém a trava durante a recarga', async () => {
    await flushLista([faseAvaliacaoSeed, faseRecursoSeed]);
    edicao.pedirRemocao(faseAvaliacaoSeed);
    edicao.removerConfirmado();
    edicao.confirmando.set(false);
    const primeira = controller.expectOne(urlRemocao(faseAvaliacaoSeed));
    edicao.pedirRemocao(faseAvaliacaoSeed);
    expect(edicao.confirmando()).toBe(false);
    edicao.pedirRemocao(faseRecursoSeed);
    edicao.removerConfirmado();
    controller.expectNone(urlRemocao(faseRecursoSeed));
    primeira.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    edicao.pedirRemocao(faseRecursoSeed);
    expect(edicao.confirmando()).toBe(false);
    await flushLista([faseRecursoSeed]);
    edicao.pedirRemocao(faseRecursoSeed);
    edicao.removerConfirmado();
    controller
      .expectOne(urlRemocao(faseRecursoSeed))
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
    expect(edicao.mensagemDaConfirmacao()).toBe('Deseja remover esta fase canônica?');
  });

  it('bloqueia o formulário durante o envio e foca o campo recusado', async () => {
    await flushLista([faseAvaliacaoSeed]);
    edicao.abrirEdicao(faseAvaliacaoSeed);
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector('#cfg-fase-canonica-form') as HTMLFormElement;
    edicao.salvar();
    fixture.detectChanges();
    expect(form.querySelector('fieldset.form-drawer__campos:disabled')).not.toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('button[form="cfg-fase-canonica-form"]')
        .getAttribute('aria-disabled'),
    ).toBe('true');
    edicao.fechar();
    expect(edicao.aberto()).toBe(true);
    edicao.salvar();
    edicao.pedirRemocao(faseRecursoSeed);
    controller.expectNone(urlRemocao(faseRecursoSeed));
    const requisicao = controller.expectOne(urlRemocao(faseAvaliacaoSeed));
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
    await propagate();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const nome = form.querySelector('[formcontrolname="nome"]') as HTMLInputElement;
    expect(nome.getAttribute('aria-invalid')).toBe('true');
    expect(form.textContent).toContain('Nome recusado.');
    expect(document.activeElement).toBe(nome);
  });

  it('a recusa que ficou em um campo não impede corrigir o outro e reenviar', async () => {
    await flushLista([faseAvaliacaoSeed]);
    edicao.abrirEdicao({ ...faseAvaliacaoSeed, coletaInscricao: true });
    edicao.salvar();
    controller.expectOne(urlRemocao(faseAvaliacaoSeed)).flush(
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
    await propagate();
    expect(edicao.form.controls.coletaSolicitacaoIsencao.hasError('backend')).toBe(true);

    edicao.form.controls.coletaInscricao.setValue(false);
    edicao.salvar();

    controller
      .expectOne(urlRemocao(faseAvaliacaoSeed))
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    expect(edicao.aberto()).toBe(false);
    controller.match((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`);
  });

  it('libera as ações se a recarga falha e permite nova leitura', async () => {
    await flushLista([faseAvaliacaoSeed]);
    edicao.abrirEdicao(faseAvaliacaoSeed);
    edicao.form.controls.descricao.disable();
    edicao.salvar();
    controller
      .expectOne(urlRemocao(faseAvaliacaoSeed))
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    expect(edicao.form.controls.descricao.disabled).toBe(true);
    edicao.pedirRemocao(faseRecursoSeed);
    expect(edicao.confirmando()).toBe(false);
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`)
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
    await propagate();
    expect(edicao.gravando()).toBe(false);
    fixture.debugElement.injector.get(FasesCanonicasStore).tentarNovamente();
    await propagate();
    await flushLista([faseAvaliacaoSeed]);
    expect(edicao.gravando()).toBe(false);
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await flushLista([faseAvaliacaoSeed]);
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('table > caption');
    // Sem `sr-only` a legenda vira texto visível acima da tabela e quebra o layout.
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Fases canônicas, com unidade sugerida, agrupamento de etapas e permissão de complementação documental',
    );
  });
});
