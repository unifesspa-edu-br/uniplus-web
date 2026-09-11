import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  apiResultInterceptor,
  createCursor,
  mockProblemDetails,
  mockValidationError,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  BaseLegalBonusRegionalDto,
  CONFIGURACAO_BASE_PATH,
  type TipoInstrumentoNormativoVocabularioDto,
} from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseLegalBonusRegionalListPage } from './base-legal-bonus-regional-list.page';

const BASE = 'http://localhost:5000';
const URL_LISTA = `${BASE}/api/configuracao/base-legal-bonus-regional`;
const URL_ADMIN = `${BASE}/api/configuracao/admin/base-legal-bonus-regional`;
const URL_TIPOS = `${BASE}/api/configuracao/vocabularios/tipos-instrumento-normativo`;
const URL_CIDADES = `${BASE}/api/cidades`;

const TIPOS: readonly TipoInstrumentoNormativoVocabularioDto[] = [
  { codigo: 'PORTARIA', nome: 'Portaria', descricao: 'Ato administrativo.' },
  { codigo: 'LEI', nome: 'Lei', descricao: 'Ato normativo.' },
];

const MARABA = { id: 'cidade-1', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' };

const portariaBase: BaseLegalBonusRegionalDto = {
  id: 'ba5e0000-0000-7000-8000-000000000001',
  tipoInstrumento: 'PORTARIA',
  identificacao: 'Portaria Unifesspa nº 2514/2023',
  descricao: 'Institui inclusão regional.',
  municipios: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }],
  criadoEm: '2026-01-01T00:00:00Z',
};

describe('BaseLegalBonusRegionalListPage', () => {
  let fixture: ComponentFixture<BaseLegalBonusRegionalListPage>;
  let component: BaseLegalBonusRegionalListPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BaseLegalBonusRegionalListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: GEO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(BaseLegalBonusRegionalListPage);
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

  function flushTipos(itens: readonly TipoInstrumentoNormativoVocabularioDto[] = TIPOS): void {
    for (const req of controller.match(URL_TIPOS)) {
      req.flush(itens);
    }
  }

  async function flushLista(itens: readonly BaseLegalBonusRegionalDto[]): Promise<void> {
    flushTipos();
    const req = controller.expectOne((r) => r.url === URL_LISTA);
    req.flush(itens);
    await propagate();
  }

  it('CA-01: renderiza a lista com tipo, identificação e quantidade de municípios', async () => {
    await flushLista([portariaBase]);
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Portaria');
    expect(texto).toContain('Portaria Unifesspa nº 2514/2023');
    expect(component['registrosBuscados']()[0].municipios.length).toBe(1);
  });

  it('bloqueia identificação e descrição em branco ou curtas demais após remover os espaços', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    component['form'].controls.tipoInstrumento.setValue('PORTARIA');
    component['form'].controls.identificacao.setValue('   ');
    component['form'].controls.descricao.setValue('  ab  ');
    component['adicionarMunicipio'](MARABA);

    component['salvar']();
    fixture.detectChanges();

    controller.expectNone((r) => r.url === URL_ADMIN && r.method === 'POST');
    expect(component['form'].controls.identificacao.errors?.['required']).toBe(true);
    expect(component['form'].controls.descricao.errors?.['minlength']).toBeTruthy();
  });

  it('CA-03: bloqueia o envio do formulário sem nenhum município adicionado', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    component['form'].controls.tipoInstrumento.setValue('PORTARIA');
    component['form'].controls.identificacao.setValue('Portaria de teste');
    component['form'].controls.descricao.setValue('Descrição de teste válida.');

    const buscaSpy = vi.spyOn(HTMLInputElement.prototype, 'focus');
    component['salvar']();
    fixture.detectChanges();

    controller.expectNone((r) => r.url === URL_ADMIN && r.method === 'POST');
    expect(component['municipiosErro']()).toBe('Adicione ao menos um município.');
    const erroEl = fixture.nativeElement.querySelector('#cfg-blbr-municipios-erro');
    expect(erroEl?.getAttribute('role')).toBe('alert');
    const buscaInput = fixture.nativeElement.querySelector(
      'input[aria-labelledby="cfg-blbr-municipios-label"]',
    );
    expect(buscaInput?.getAttribute('aria-describedby')).toBe('cfg-blbr-municipios-erro');
    expect(buscaInput?.getAttribute('aria-invalid')).toBe('true');
    expect(buscaSpy).toHaveBeenCalled();
    buscaSpy.mockRestore();
  });

  it('mostra o código do tipo de instrumento não mais listado no vocabulário em vez de esconder o valor', async () => {
    const baseComTipoDesconhecido = { ...portariaBase, tipoInstrumento: 'PARECER_ANTIGO' };
    await flushLista([baseComTipoDesconhecido]);
    component['abrirEdicao'](baseComTipoDesconhecido);
    fixture.detectChanges();

    expect(component['tipoInstrumentoForaDasOpcoes']()).toBe('PARECER_ANTIGO');
    const opcao = fixture.nativeElement.querySelector('option[value="PARECER_ANTIGO"]');
    expect(opcao).not.toBeNull();
  });

  it('resposta de uma desativação cancelada não limpa a confirmação de um registro mais novo', async () => {
    const outraBase: BaseLegalBonusRegionalDto = { ...portariaBase, id: 'ba5e0000-0000-7000-8000-000000000002' };
    await flushLista([portariaBase, outraBase]);
    fixture.detectChanges();

    component['pedirDesativacao'](portariaBase);
    component['confirmarDesativacao']();
    const requisicaoAntiga = controller.expectOne(
      (r) => r.url === `${URL_ADMIN}/${portariaBase.id}` && r.method === 'DELETE',
    );

    component['pedirDesativacao'](outraBase);
    fixture.detectChanges();

    requisicaoAntiga.flush(null);
    await propagate();

    expect(component['baseParaDesativar']()).toEqual(outraBase);
    expect(component['savingDesativar']()).toBe(false);
    // O sucesso de A recarrega a lista mesmo superado por B — o registro removido
    // não pode continuar aparecendo até uma atualização não relacionada.
    controller.expectOne((r) => r.url === URL_LISTA).flush([outraBase]);
  });

  it('reporta a falha de uma desativação superada, mesmo sem mais controlar o diálogo dela', async () => {
    const outraBase: BaseLegalBonusRegionalDto = { ...portariaBase, id: 'ba5e0000-0000-7000-8000-000000000003' };
    await flushLista([portariaBase, outraBase]);
    fixture.detectChanges();

    const notifications = TestBed.inject(NotificationService);
    const erroSpy = vi.spyOn(notifications, 'errorFromProblem');

    component['pedirDesativacao'](portariaBase);
    component['confirmarDesativacao']();
    const requisicaoAntiga = controller.expectOne(
      (r) => r.url === `${URL_ADMIN}/${portariaBase.id}` && r.method === 'DELETE',
    );

    component['pedirDesativacao'](outraBase);
    fixture.detectChanges();

    requisicaoAntiga.flush(
      mockProblemDetails({ status: 409, code: 'uniplus.conflito' }),
      { status: 409, statusText: 'Conflict', headers: { 'content-type': 'application/problem+json' } },
    );
    await propagate();

    expect(erroSpy).toHaveBeenCalled();
    // O diálogo em tela pertence a B — a falha de A não mexe nele.
    expect(component['baseParaDesativar']()).toEqual(outraBase);
    expect(component['savingDesativar']()).toBe(false);
  });

  it('CA-04: só busca município a partir de 3 caracteres, com debounce', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    component['buscarMunicipios']('Ma');
    await new Promise((resolve) => setTimeout(resolve, 350));
    controller.expectNone((r) => r.url === URL_CIDADES);

    component['buscarMunicipios']('Marabá');
    await new Promise((resolve) => setTimeout(resolve, 350));
    controller.expectOne((r) => r.url === URL_CIDADES).flush([MARABA]);
  });

  it('adiciona e remove um município da lista selecionada', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    component['adicionarMunicipio'](MARABA);
    expect(component['municipiosSelecionados']()).toHaveLength(1);
    expect(component['municipiosErro']()).toBeNull();

    component['removerMunicipio'](MARABA.codigoIbge);
    expect(component['municipiosSelecionados']()).toHaveLength(0);
  });

  it('cria uma base legal quando o formulário e os municípios são válidos', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    component['form'].controls.tipoInstrumento.setValue('PORTARIA');
    component['form'].controls.identificacao.setValue('Portaria de teste');
    component['form'].controls.descricao.setValue('Descrição de teste válida.');
    component['adicionarMunicipio'](MARABA);

    component['salvar']();
    const req = controller.expectOne((r) => r.url === URL_ADMIN && r.method === 'POST');
    expect(req.request.body).toEqual({
      tipoInstrumento: 'PORTARIA',
      identificacao: 'Portaria de teste',
      descricao: 'Descrição de teste válida.',
      municipios: [{ codigoIbge: MARABA.codigoIbge, nome: MARABA.nome, uf: MARABA.uf }],
    });
    req.flush(portariaBase.id);
    await propagate();

    expect(component['formOpen']()).toBe(false);
    controller.expectOne((r) => r.url === URL_LISTA).flush([portariaBase]);
  });

  it('mapeia erro de validação 422 para o campo correspondente do formulário', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    component['form'].controls.tipoInstrumento.setValue('PORTARIA');
    component['form'].controls.identificacao.setValue('Portaria de teste');
    component['form'].controls.descricao.setValue('Descrição de teste válida.');
    component['adicionarMunicipio'](MARABA);

    component['salvar']();
    const req = controller.expectOne((r) => r.url === URL_ADMIN && r.method === 'POST');
    req.flush(
      mockProblemDetails({
        status: 422,
        errors: [
          mockValidationError({
            field: 'identificacao',
            message: 'Já existe uma base legal com esta identificação.',
          }),
        ],
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();
    fixture.detectChanges();

    expect(component['erroDoCampo']('identificacao')).toBe(
      'Já existe uma base legal com esta identificação.',
    );
    // A falha reabilita os campos: o operador precisa poder corrigir o valor rejeitado.
    expect(component['form'].disabled).toBe(false);
  });

  it('desabilita os campos do formulário e a busca/remoção de municípios enquanto o envio está em voo', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();
    component['form'].controls.tipoInstrumento.setValue('PORTARIA');
    component['form'].controls.identificacao.setValue('Portaria de teste');
    component['form'].controls.descricao.setValue('Descrição de teste válida.');
    component['adicionarMunicipio'](MARABA);
    fixture.detectChanges();

    component['salvar']();
    fixture.detectChanges();
    const requisicao = controller.expectOne((r) => r.url === URL_ADMIN && r.method === 'POST');

    expect(component['form'].disabled).toBe(true);
    const buscaInput = fixture.nativeElement.querySelector<HTMLInputElement>(
      'input[aria-labelledby="cfg-blbr-municipios-label"]',
    );
    expect(buscaInput?.disabled).toBe(true);
    const removerBtn = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '.cfg-municipio-selecionados button',
    );
    expect(removerBtn?.disabled).toBe(true);

    requisicao.flush(portariaBase.id);
    await propagate();
    fixture.detectChanges();

    expect(component['formOpen']()).toBe(false);
    controller.expectOne((r) => r.url === URL_LISTA).flush([portariaBase]);
  });

  it('cancela a busca de município em voo ao limpar o termo', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();

    component['buscarMunicipios']('Marabá');
    await new Promise((resolve) => setTimeout(resolve, 350));
    const buscaAntiga = controller.expectOne((r) => r.url === URL_CIDADES);

    component['buscarMunicipios']('');
    await propagate();

    expect(buscaAntiga.cancelled).toBe(true);
    expect(component['buscaMunicipioResultados']()).toEqual([]);
  });

  it('abrirCadastro não descarta o formulário nem interfere no envio ainda em voo', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();
    component['form'].controls.tipoInstrumento.setValue('PORTARIA');
    component['form'].controls.identificacao.setValue('Portaria de teste');
    component['form'].controls.descricao.setValue('Descrição de teste válida.');
    component['adicionarMunicipio'](MARABA);

    component['salvar']();
    const requisicao = controller.expectOne((r) => r.url === URL_ADMIN && r.method === 'POST');

    // Nenhum caminho de reabertura (clique bloqueado pelo drawer modal, Esc, ou uma
    // chamada direta) pode descartar um envio que já está em voo.
    component['abrirCadastro']();
    fixture.detectChanges();

    expect(requisicao.cancelled).toBeFalsy();
    expect(component['form'].controls.identificacao.value).toBe('Portaria de teste');
    expect(component['savingForm']()).toBe(true);

    requisicao.flush(portariaBase.id);
    await propagate();

    expect(component['formOpen']()).toBe(false);
    controller.expectOne((r) => r.url === URL_LISTA).flush([portariaBase]);
  });

  it('desabilita fechar o drawer (Cancelar e X) enquanto o salvamento está em voo e libera ao resolver', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();
    component['form'].controls.tipoInstrumento.setValue('PORTARIA');
    component['form'].controls.identificacao.setValue('Portaria de teste');
    component['form'].controls.descricao.setValue('Descrição de teste válida.');
    component['adicionarMunicipio'](MARABA);

    component['salvar']();
    fixture.detectChanges();
    const requisicao = controller.expectOne((r) => r.url === URL_ADMIN && r.method === 'POST');

    const cancelarBtn = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLButtonElement>('.cfg-form-footer button'),
    ).find((btn) => btn.textContent?.trim() === 'Cancelar');
    const fecharBtn = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '.uni-drawer__header button',
    );
    expect(cancelarBtn?.disabled).toBe(true);
    expect(fecharBtn?.disabled).toBe(true);

    requisicao.flush(portariaBase.id);
    await propagate();
    fixture.detectChanges();

    expect(component['formOpen']()).toBe(false);
    controller.expectOne((r) => r.url === URL_LISTA).flush([portariaBase]);

    component['abrirCadastro']();
    fixture.detectChanges();
    const fecharBtnDepois = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '.uni-drawer__header button',
    );
    expect(fecharBtnDepois?.disabled).toBe(false);
  });

  it('falha fora do contrato ApiResult mostra mensagem de erro em vez da lista vazia', async () => {
    flushTipos();
    const req = controller.expectOne((r) => r.url === URL_LISTA);
    req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    await propagate();
    fixture.detectChanges();

    expect(component['errorMessage']()).not.toBeNull();
    expect(fixture.nativeElement.textContent as string).not.toContain('Nenhuma base legal cadastrada');
  });

  it('reinicia a paginação ao tentar novamente após cursor rejeitado, em vez de repetir a página quebrada', async () => {
    await flushLista([portariaBase]);
    fixture.detectChanges();

    component['pagina'].set({ cursor: createCursor('cursor-invalido'), direction: 'next' });
    await propagate();

    const requisicaoComCursor = controller.expectOne(
      (r) => r.url === URL_LISTA && r.params.get('cursor') === 'cursor-invalido',
    );
    requisicaoComCursor.flush(
      mockProblemDetails({ status: 410, code: 'uniplus.cursor.expirado' }),
      {
        status: 410,
        statusText: 'Gone',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();
    fixture.detectChanges();

    component['tentarNovamente']();
    await propagate();

    const requisicaoReiniciada = controller.expectOne((r) => r.url === URL_LISTA);
    expect(requisicaoReiniciada.request.params.has('cursor')).toBe(false);
    requisicaoReiniciada.flush([portariaBase]);
  });

  it('foca e anuncia o primeiro campo inválido quando o envio falha fora da validação de municípios', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    fixture.detectChanges();
    component['adicionarMunicipio'](MARABA);

    const focoSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    component['salvar']();
    fixture.detectChanges();

    controller.expectNone((r) => r.url === URL_ADMIN && r.method === 'POST');
    expect(focoSpy).toHaveBeenCalled();
    const erroTipo = fixture.nativeElement.querySelector('#cfg-blbr-tipo-erro');
    expect(erroTipo?.getAttribute('role')).toBe('alert');
    focoSpy.mockRestore();
  });

  it('CA-05: pede confirmação antes de desativar e só chama o backend após confirmar', async () => {
    await flushLista([portariaBase]);
    fixture.detectChanges();

    component['pedirDesativacao'](portariaBase);
    fixture.detectChanges();
    expect(component['confirmDesativarAberto']()).toBe(true);
    controller.expectNone((r) => r.url === `${URL_ADMIN}/${portariaBase.id}`);

    component['confirmarDesativacao']();
    const req = controller.expectOne(
      (r) => r.url === `${URL_ADMIN}/${portariaBase.id}` && r.method === 'DELETE',
    );
    req.flush(null);
    await propagate();
    controller.expectOne((r) => r.url === URL_LISTA).flush([]);
  });
});
