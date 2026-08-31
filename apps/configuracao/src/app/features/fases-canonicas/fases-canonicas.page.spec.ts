import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FasesCanonicasPage } from './fases-canonicas.page';

const BASE = 'http://localhost:5000';

const faseAvaliacaoSeed: FaseCanonicaDto = {
  id: '01960000-0000-7000-0000-0000000000f1',
  codigo: 'AVALIACAO',
  nome: 'Avaliação',
  descricao: null,
  donoTipico: 'CEPS',
  agrupaEtapas: true,
  permiteComplementacao: false,
  baseLegal: null,
  produzResultado: false,
  resultadoDefinitivo: false,
  coletaInscricao: false,
  origemData: 'PROPRIA',
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('FasesCanonicasPage', () => {
  let fixture: ComponentFixture<FasesCanonicasPage>;
  let component: FasesCanonicasPage;
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
      ],
    });
    fixture = TestBed.createComponent(FasesCanonicasPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  async function flushLista(itens: readonly FaseCanonicaDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/fases-canonicas`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(itens);
    await propagate();
  }

  it('CA-01: renderiza a lista de fases canônicas', async () => {
    await flushLista([faseAvaliacaoSeed]);
    expect(component['fases']()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Avaliação');
    expect(fixture.nativeElement.textContent).toContain('AVALIACAO');
  });

  it('CA-10: banner de código imutável é visível mesmo com lista vazia', async () => {
    await flushLista([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Código imutável após criação');
  });

  it('CA-02: filtro de dono típico filtra registros carregados', async () => {
    const faseCrca: FaseCanonicaDto = { ...faseAvaliacaoSeed, id: 'f2', codigo: 'MATRICULA', donoTipico: 'CRCA' };
    await flushLista([faseAvaliacaoSeed, faseCrca]);

    component['donoTipicoFiltro'].set('CRCA');
    expect(component['fasesFiltradas']()).toEqual([faseCrca]);
  });

  it('CA-05: grupo "Agrupamento de etapas" só aparece para AVALIACAO', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    expect(component['showGrupoAgrupa']()).toBe(false);

    component['form'].controls.codigo.setValue('AVALIACAO');
    expect(component['showGrupoAgrupa']()).toBe(true);
    expect(component['showGrupoCompl']()).toBe(false);

    component['form'].controls.codigo.setValue('HOMOLOGACAO');
    expect(component['showGrupoAgrupa']()).toBe(false);
    expect(component['showGrupoCompl']()).toBe(true);

    component['form'].controls.codigo.setValue('MATRICULA');
    expect(component['showGrupoAgrupa']()).toBe(false);
    expect(component['showGrupoCompl']()).toBe(false);
  });

  it('CA-02: o select oferece a solicitação de isenção, e ela não agrupa etapas nem admite complementação', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    const codigoSelect = fixture.nativeElement.querySelector(
      '[formControlName="codigo"]',
    ) as HTMLSelectElement;
    const opcoes = Array.from(codigoSelect.options).map((o) => o.value);

    expect(opcoes).toContain('SOLICITACAO_ISENCAO');

    // Espelha o backend: só a avaliação agrupa etapas, e a complementação
    // documental segue restrita a homologação e recursos.
    component['form'].controls.codigo.setValue('SOLICITACAO_ISENCAO');
    expect(component['showGrupoAgrupa']()).toBe(false);
    expect(component['showGrupoCompl']()).toBe(false);
  });

  it('CA-05: interação real via DOM no select [ngValue] de "Agrupa etapas" atualiza o boolean do form', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].controls.codigo.setValue('AVALIACAO');
    fixture.detectChanges();

    const agrupaSelect = fixture.nativeElement.querySelector(
      '[formControlName="agrupaEtapas"]',
    ) as HTMLSelectElement;
    expect(agrupaSelect).toBeTruthy();
    expect(component['form'].controls.agrupaEtapas.value).toBe(false);

    agrupaSelect.value = agrupaSelect.options[0].value; // "Sim" → [ngValue]="true"
    agrupaSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component['form'].controls.agrupaEtapas.value).toBe(true);
  });

  it('CA-05: submeter fora de AVALIACAO/HOMOLOGACAO/RECURSOS força os sinalizadores para false', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].setValue({
      codigo: 'MATRICULA',
      donoTipico: 'CEPS',
      nome: 'Matrícula',
      descricao: '',
      baseLegal: '',
      agrupaEtapas: true, // valor "vazado" de uma seleção anterior — não deve ser enviado
      permiteComplementacao: true,
      origemData: 'PROPRIA',
      produzResultado: false,
      resultadoDefinitivo: false,
      coletaInscricao: false,
    });

    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/fases-canonicas`);
    expect(post.request.body).toMatchObject({
      codigo: 'MATRICULA',
      agrupaEtapas: false,
      permiteComplementacao: false,
      origemData: 'PROPRIA',
      produzResultado: false,
      resultadoDefinitivo: false,
      coletaInscricao: false,
    });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('CA-06: código é readonly na edição e o payload de atualização não inclui o campo codigo', async () => {
    await flushLista([faseAvaliacaoSeed]);
    component['abrirEdicao'](faseAvaliacaoSeed);
    expect(component['form'].controls.codigo.value).toBe('AVALIACAO');
    fixture.detectChanges();
    const codigoInput = fixture.nativeElement.querySelector(
      '[formcontrolname="codigo"]',
    ) as HTMLInputElement;
    expect(codigoInput.readOnly).toBe(true);

    component['form'].controls.nome.setValue('Avaliação (revisada)');
    component['salvar']();

    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseAvaliacaoSeed.id}`,
    );
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).not.toHaveProperty('codigo');
    expect(put.request.body).toMatchObject({ id: faseAvaliacaoSeed.id, nome: 'Avaliação (revisada)' });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([faseAvaliacaoSeed]);
  });

  it('CA-07: código duplicado (409) é rejeitado com erro no campo sem fechar o drawer', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].setValue({
      codigo: 'AVALIACAO',
      donoTipico: 'CEPS',
      nome: 'Avaliação (dup)',
      descricao: '',
      baseLegal: '',
      agrupaEtapas: false,
      permiteComplementacao: false,
      origemData: 'PROPRIA',
      produzResultado: false,
      resultadoDefinitivo: false,
      coletaInscricao: false,
    });

    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/fases-canonicas`);
    post.flush(
      {
        type: 'https://uniplus.dev/erros/uniplus.configuracao.fase_canonica.codigo_ja_existe',
        title: 'Já existe uma fase canônica ativa com este código',
        status: 409,
        code: 'uniplus.configuracao.fase_canonica.codigo_ja_existe',
      },
      { status: 409, statusText: 'Conflict', headers: { 'Content-Type': 'application/problem+json' } },
    );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['erroDoCampo']('codigo')).toContain(
      'Já existe uma fase canônica ativa com este código',
    );
    expect(component['formError']()).toBeNull();
  });

  it('origem da data é obrigatória e viaja no payload de criação', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].setValue({
      codigo: 'MATRICULA',
      donoTipico: 'CRCA',
      nome: 'Matrícula',
      descricao: '',
      baseLegal: '',
      agrupaEtapas: false,
      permiteComplementacao: false,
      origemData: '',
      produzResultado: false,
      resultadoDefinitivo: false,
      coletaInscricao: false,
    });

    // O backend exige `origemData`; sem o campo no formulário, toda criação
    // era recusada com 422 (#501).
    component['salvar']();
    controller.expectNone(`${BASE}/api/configuracao/admin/fases-canonicas`);

    component['form'].controls.origemData.setValue('DELEGADA');
    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/fases-canonicas`);
    expect(post.request.body).toMatchObject({ origemData: 'DELEGADA' });
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('resultado definitivo sem produção de resultado é barrado e não vaza no payload', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].setValue({
      codigo: 'RESULTADO_FINAL',
      donoTipico: 'CEPS',
      nome: 'Resultado final',
      descricao: '',
      baseLegal: '',
      agrupaEtapas: false,
      permiteComplementacao: false,
      origemData: 'PROPRIA',
      produzResultado: false,
      resultadoDefinitivo: true,
      coletaInscricao: false,
    });

    // Mesma regra do backend: definitivo exige produzir resultado.
    expect(component['form'].hasError('resultadoDefinitivoSemProducao')).toBe(true);
    component['salvar']();
    controller.expectNone(`${BASE}/api/configuracao/admin/fases-canonicas`);

    component['form'].controls.produzResultado.setValue(true);
    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/fases-canonicas`);
    expect(post.request.body).toMatchObject({
      produzResultado: true,
      resultadoDefinitivo: true,
    });
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('desmarcar "produz resultado" zera o definitivo e não trava o envio', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].setValue({
      codigo: 'RESULTADO_PRELIMINAR',
      donoTipico: 'CEPS',
      nome: 'Resultado preliminar',
      descricao: '',
      baseLegal: '',
      agrupaEtapas: false,
      permiteComplementacao: false,
      origemData: 'PROPRIA',
      produzResultado: true,
      resultadoDefinitivo: true,
      coletaInscricao: false,
    });

    // Voltar atrás esconde o controle de resultado definitivo; se o valor
    // sobrevivesse, o validador do grupo barraria o envio sem exibir erro
    // algum — o campo culpado já não está na tela.
    component['form'].controls.produzResultado.setValue(false);
    expect(component['showResultadoDefinitivo']()).toBe(false);
    expect(component['form'].controls.resultadoDefinitivo.value).toBe(false);
    expect(component['form'].valid).toBe(true);

    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/fases-canonicas`);
    expect(post.request.body).toMatchObject({
      produzResultado: false,
      resultadoDefinitivo: false,
    });
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('edição carrega os sinalizadores do DTO e os devolve na atualização', async () => {
    const faseComResultado: FaseCanonicaDto = {
      ...faseAvaliacaoSeed,
      produzResultado: true,
      resultadoDefinitivo: true,
      coletaInscricao: false,
      origemData: 'DELEGADA',
    };
    await flushLista([faseComResultado]);

    component['abrirEdicao'](faseComResultado);
    expect(component['form'].controls.origemData.value).toBe('DELEGADA');
    expect(component['form'].controls.produzResultado.value).toBe(true);
    expect(component['form'].controls.resultadoDefinitivo.value).toBe(true);

    component['salvar']();
    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseComResultado.id}`,
    );
    expect(put.request.body).toMatchObject({
      origemData: 'DELEGADA',
      produzResultado: true,
      resultadoDefinitivo: true,
      coletaInscricao: false,
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([faseComResultado]);
  });

  it('CA-08: inativa uma fase canônica após confirmação', async () => {
    await flushLista([faseAvaliacaoSeed]);
    component['pedirRemocao'](faseAvaliacaoSeed);
    component['removerConfirmado']();

    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseAvaliacaoSeed.id}`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
  });
});
