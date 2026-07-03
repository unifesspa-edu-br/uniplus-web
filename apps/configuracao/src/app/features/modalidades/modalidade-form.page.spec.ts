import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModalidadeFormPage } from './modalidade-form.page';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/modalidades`;

function modalidade(over: Partial<ModalidadeDto>): ModalidadeDto {
  return {
    id: over.id ?? crypto.randomUUID(),
    codigo: 'AC',
    descricao: 'Ampla concorrência',
    naturezaLegal: 'AMPLA',
    composicaoVagas: 'RESIDUAL_DO_VO',
    composicaoOrigem: null,
    regraRemanejamento: null,
    remanejamentoDestino: null,
    remanejamentoPar: null,
    remanejamentoFallback: null,
    criteriosCumulativos: [],
    acaoQuandoIndeferido: null,
    baseLegal: null,
    criadoEm: '2026-07-03T12:00:00Z',
    ...over,
  };
}

const AC = modalidade({ id: 'id-ac', codigo: 'AC' });
const LB_PPI = modalidade({
  id: 'id-lb',
  codigo: 'LB_PPI',
  descricao: 'Cota PPI baixa renda',
  naturezaLegal: 'COTA_RESERVADA',
  composicaoVagas: 'DENTRO_DO_VR',
  regraRemanejamento: 'SEGUE_CASCATA',
});

describe('ModalidadeFormPage', () => {
  let fixture: ComponentFixture<ModalidadeFormPage>;
  let component: ModalidadeFormPage;
  let controller: HttpTestingController;

  beforeEach(() => {
    // Modo criação por padrão (sem `id`); os testes de edição trocam a rota via `usarRota`.
    TestBed.configureTestingModule({
      imports: [ModalidadeFormPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'modalidades', children: [] }]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({}) } },
        },
      ],
    });
  });

  afterEach(() => controller.verify());

  /** Instancia o componente e libera o GET das modalidades vivas (selects de FK). */
  function montar(vivas: readonly ModalidadeDto[] = [AC, LB_PPI]): void {
    fixture = TestBed.createComponent(ModalidadeFormPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    const req = controller.expectOne((r) => r.url === URL && r.params.get('limit') === '100');
    req.flush([...vivas]);
  }

  /** Reconfigura a rota para modo edição antes de montar. */
  function usarRota(id: string): void {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
    });
  }

  const setControl = (nome: string, valor: string): void => {
    component['form'].get(nome)?.setValue(valor);
  };

  it('ModalidadeForm_Natureza_AmplaOcultaRemanejamento', () => {
    montar();
    setControl('naturezaLegal', 'AMPLA');
    component['aoMudarNatureza']();
    expect(component['mostraRemanejamento']()).toBe(false);
    expect(component['form'].controls.regraRemanejamento.value).toBe('');
  });

  it('ModalidadeForm_Natureza_CotaFixaCascata', () => {
    montar();
    setControl('naturezaLegal', 'COTA_RESERVADA');
    component['aoMudarNatureza']();
    expect(component['form'].controls.regraRemanejamento.value).toBe('SEGUE_CASCATA');
    expect(component['regraDesabilitada']('SEGUE_CASCATA')).toBe(false);
    expect(component['regraDesabilitada']('DESTINO_UNICO')).toBe(true);
    expect(component['regraDesabilitada']('CRUZADO')).toBe(true);
  });

  it('ModalidadeForm_Natureza_SuplementarOfertaDestinoOuCruzado', () => {
    montar();
    setControl('naturezaLegal', 'SUPLEMENTAR');
    component['aoMudarNatureza']();
    expect(component['regraDesabilitada']('SEGUE_CASCATA')).toBe(true);
    expect(component['regraDesabilitada']('DESTINO_UNICO')).toBe(false);
    expect(component['regraDesabilitada']('CRUZADO')).toBe(false);
    // Regra passa a ser obrigatória.
    expect(component['form'].controls.regraRemanejamento.invalid).toBe(true);
  });

  it('ModalidadeForm_RetiraDe_ExigeOrigem', () => {
    montar();
    setControl('composicaoVagas', 'RETIRA_DE');
    component['aoMudarComposicao']();
    expect(component['mostraOrigem']()).toBe(true);
    expect(component['form'].controls.composicaoOrigem.invalid).toBe(true);
    component['form'].controls.composicaoOrigem.setValue('AC');
    expect(component['form'].controls.composicaoOrigem.valid).toBe(true);
    // Voltar para outra composição limpa e desobriga a origem.
    setControl('composicaoVagas', 'RESIDUAL_DO_VO');
    component['aoMudarComposicao']();
    expect(component['mostraOrigem']()).toBe(false);
    expect(component['form'].controls.composicaoOrigem.value).toBe('');
  });

  it('ModalidadeForm_Args_PorRegra', () => {
    montar();
    setControl('naturezaLegal', 'SUPLEMENTAR');
    component['aoMudarNatureza']();
    setControl('regraRemanejamento', 'DESTINO_UNICO');
    component['aoMudarRegra']();
    expect(component['mostraDestino']()).toBe(true);
    expect(component['mostraParFallback']()).toBe(false);
    expect(component['form'].controls.remanejamentoDestino.invalid).toBe(true);

    setControl('remanejamentoDestino', 'AC');
    setControl('regraRemanejamento', 'CRUZADO');
    component['aoMudarRegra']();
    // Destino é limpo; par e fallback passam a ser exigidos.
    expect(component['form'].controls.remanejamentoDestino.value).toBe('');
    expect(component['mostraParFallback']()).toBe(true);
    expect(component['form'].controls.remanejamentoPar.invalid).toBe(true);
    expect(component['form'].controls.remanejamentoFallback.invalid).toBe(true);
  });

  it('ModalidadeForm_Codigo_RegexEUnicidade', () => {
    montar();
    const codigo = component['form'].controls.codigo;
    codigo.setValue('AB-C');
    expect(codigo.hasError('pattern')).toBe(true);
    codigo.setValue('AB_C');
    expect(codigo.valid).toBe(true);
    // Unicidade entre vivas carregadas.
    codigo.setValue('AC');
    component['verificarCodigoDuplicado']();
    expect(codigo.hasError('duplicado')).toBe(true);
  });

  it('ModalidadeForm_Codigo_ReadonlyNaEdicao', () => {
    usarRota('id-lb');
    montar();
    const obter = controller.expectOne(`${URL}/id-lb`);
    obter.flush(LB_PPI);
    expect(component['modoEdicao']()).toBe(true);
    expect(component['form'].controls.codigo.disabled).toBe(true);
    expect(component['form'].controls.codigo.value).toBe('LB_PPI');
  });

  it('ModalidadeForm_TrocaNatureza_ResetaDependentes', () => {
    montar();
    setControl('naturezaLegal', 'SUPLEMENTAR');
    component['aoMudarNatureza']();
    setControl('regraRemanejamento', 'CRUZADO');
    component['aoMudarRegra']();
    component['form'].controls.remanejamentoPar.setValue('AC');
    component['form'].controls.remanejamentoFallback.setValue('LB_PPI');

    // Trocar para AMPLA com args preenchidos pede confirmação (§5).
    setControl('naturezaLegal', 'AMPLA');
    component['aoMudarNatureza']();
    expect(component['confirmResetAberto']()).toBe(true);
    expect(component['form'].controls.regraRemanejamento.value).toBe('CRUZADO');

    component['confirmarResetNatureza']();
    expect(component['confirmResetAberto']()).toBe(false);
    expect(component['mostraRemanejamento']()).toBe(false);
    expect(component['form'].controls.regraRemanejamento.value).toBe('');
    expect(component['form'].controls.remanejamentoPar.value).toBe('');
    expect(component['form'].controls.remanejamentoFallback.value).toBe('');
  });

  it('ModalidadeForm_TrocaNatureza_CancelarPreserva', () => {
    montar();
    setControl('naturezaLegal', 'SUPLEMENTAR');
    component['aoMudarNatureza']();
    setControl('regraRemanejamento', 'DESTINO_UNICO');
    component['aoMudarRegra']();
    component['form'].controls.remanejamentoDestino.setValue('AC');

    setControl('naturezaLegal', 'COTA_RESERVADA');
    component['aoMudarNatureza']();
    expect(component['confirmResetAberto']()).toBe(true);

    component['cancelarResetNatureza']();
    // Reverte a natureza e preserva os campos.
    expect(component['form'].controls.naturezaLegal.value).toBe('SUPLEMENTAR');
    expect(component['form'].controls.remanejamentoDestino.value).toBe('AC');
  });

  it('ModalidadeForm_TrocaNatureza_CascataAutoNaoPrompt', () => {
    montar();
    setControl('naturezaLegal', 'COTA_RESERVADA');
    component['aoMudarNatureza']();
    // regra auto-preenchida SEGUE_CASCATA, sem argumentos digitados pelo usuário.
    setControl('naturezaLegal', 'SUPLEMENTAR');
    component['aoMudarNatureza']();
    // Não pede confirmação (nada do usuário a descartar); aplica direto.
    expect(component['confirmResetAberto']()).toBe(false);
    expect(component['form'].controls.naturezaLegal.value).toBe('SUPLEMENTAR');
    expect(component['form'].controls.regraRemanejamento.value).toBe('');
    expect(component['regraDesabilitada']('SEGUE_CASCATA')).toBe(true);
  });

  it('montarComandoCriar anula campos inaplicáveis por coerência', () => {
    montar();
    setControl('codigo', 'AC2');
    setControl('naturezaLegal', 'AMPLA');
    component['aoMudarNatureza']();
    setControl('composicaoVagas', 'RESIDUAL_DO_VO');
    component['aoMudarComposicao']();
    const cmd = component['montarComandoCriar']();
    expect(cmd.codigo).toBe('AC2');
    expect(cmd.regraRemanejamento).toBeNull();
    expect(cmd.composicaoOrigem).toBeNull();
    expect(cmd.remanejamentoDestino).toBeNull();
    expect(cmd.remanejamentoPar).toBeNull();
    expect(cmd.remanejamentoFallback).toBeNull();
  });

  it('CA-02: cria modalidade válida (POST com Idempotency-Key)', () => {
    montar();
    setControl('codigo', 'V');
    setControl('descricao', 'PcD ampla concorrência');
    setControl('naturezaLegal', 'SUPLEMENTAR');
    component['aoMudarNatureza']();
    setControl('composicaoVagas', 'RETIRA_DE');
    component['aoMudarComposicao']();
    setControl('composicaoOrigem', 'AC');
    setControl('regraRemanejamento', 'DESTINO_UNICO');
    component['aoMudarRegra']();
    setControl('remanejamentoDestino', 'AC');

    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/modalidades`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body.codigo).toBe('V');
    expect(post.request.body.composicaoOrigem).toBe('AC');
    expect(post.request.body.remanejamentoDestino).toBe('AC');
    expect(post.request.body.regraRemanejamento).toBe('DESTINO_UNICO');
    post.flush('novo-id', { status: 201, statusText: 'Created' });
  });

  it('CA-05: código inválido bloqueia o submit (sem POST)', () => {
    montar();
    setControl('codigo', '');
    component['salvar']();
    controller.expectNone(`${BASE}/api/configuracao/admin/modalidades`);
    expect(component['form'].controls.codigo.invalid).toBe(true);
  });
});
