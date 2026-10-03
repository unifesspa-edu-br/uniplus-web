import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FatosCandidatoPage } from './fatos-candidato.page';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/admin/fatos-candidato`;
const FASES = `${BASE}/api/configuracao/fases-canonicas`;
const PROBLEMA = (status: number) => ({ status, statusText: 'Recusa', headers: { 'content-type': 'application/problem+json' } });

describe('FatosCandidatoPage', () => {
  let fixture: ComponentFixture<FatosCandidatoPage>;
  let component: FatosCandidatoPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FatosCandidatoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(FatosCandidatoPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  function atenderFases(): void {
    for (const req of controller.match((r) => r.url === FASES)) {
      req.flush([{ id: 'f1', codigo: 'INSCRICAO', nome: 'Inscrição', descricao: null }]);
    }
  }

  it('CA-01: a situação e a origem escolhidas chegam à consulta da API', async () => {
    atenderFases();
    const primeira = controller.expectOne((r) => r.url === LISTA);
    expect(primeira.request.params.get('ativo')).toBe('true');
    expect(primeira.request.params.has('origem')).toBe(false);
    primeira.flush([]);
    await propagar();

    component['filtroOrigem'].set('DERIVADO');
    component['filtroSituacao'].set('');
    fixture.detectChanges();
    await propagar();

    const filtrada = controller.expectOne((r) => r.url === LISTA);
    expect(filtrada.request.params.get('origem')).toBe('DERIVADO');
    expect(filtrada.request.params.has('ativo')).toBe(false);
    filtrada.flush([]);
  });

  it('sem a lista de fases, a criação avisa e oferece tentar de novo em vez de um campo vazio', async () => {
    for (const req of controller.match((r) => r.url === FASES)) {
      req.flush(JSON.stringify({ status: 503, title: 'Indisponível', code: 'uniplus.indisponivel' }), PROBLEMA(503));
    }
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();

    component['abrirCriacao']();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).ownerDocument.body.textContent).toContain('Fases não carregadas');
  });

  it('a falha na primeira página do filtro novo não deixa no paginador o cursor do filtro anterior', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([], { headers: { Link: `<${LISTA}?cursor=pagina-2&direction=next>; rel="next"` } });
    await propagar();
    expect(component['nextCursor']()).not.toBeNull();

    component['filtroOrigem'].set('DERIVADO');
    fixture.detectChanges();
    await propagar();
    controller
      .expectOne((r) => r.url === LISTA)
      .flush(JSON.stringify({ status: 503, title: 'Indisponível', code: 'uniplus.indisponivel' }), PROBLEMA(503));
    await propagar();

    expect(component['nextCursor']()).toBeNull();
  });

  it('trocar o filtro volta à primeira página, e a escolha que saiu das opções se esvazia', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();
    component['pagina'].set({ cursor: { afterId: 'x' } as never, direction: 'next' });
    fixture.detectChanges();
    await propagar();
    controller.expectOne((r) => r.url === LISTA && r.params.has('cursor')).flush([]);
    await propagar();

    component['filtroOrigem'].set('DECLARADO');
    fixture.detectChanges();
    await propagar();
    const filtrada = controller.expectOne((r) => r.url === LISTA);
    expect(filtrada.request.params.has('cursor'), 'o cursor era do filtro anterior').toBe(false);
    filtrada.flush([]);

    component['form'].patchValue({ tipo: 'DECLARADO', dominio: 'TEXTO' });
    fixture.detectChanges();
    component['form'].patchValue({ tipo: 'DERIVADO' });
    fixture.detectChanges();
    expect(component['form'].controls.dominio.value, 'o derivado não é texto').toBe('');
  });

  it('a recusa da API chega ao campo: a de validação no campo dela, o código repetido no código', async () => {
    atenderFases();
    controller.expectOne((r) => r.url === LISTA).flush([]);
    await propagar();
    component['abrirCriacao']();
    fixture.detectChanges();
    component['form'].patchValue({
      tipo: 'DERIVADO',
      nome: 'Perfil socioeconômico',
      codigo: 'PERFIL',
      dominio: 'BOOLEANO',
      pontoResolucao: 'INSCRICAO',
      classificacaoProtecao: 'PESSOAL',
      finalidadeTratamento: 'Classificar a reserva de vagas.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    });

    component['criar']();
    const derivado = controller.expectOne(`${LISTA}/derivados`);
    expect(derivado.request.body).not.toHaveProperty('cardinalidade');
    derivado.flush(
      JSON.stringify({
        status: 422,
        code: 'uniplus.validation_failed',
        title: 'Requisição inválida',
        errors: [{ field: 'PontoResolucao', code: 'uniplus.configuracao.fato_candidato.ponto_resolucao_invalido', message: 'Fase fora do catálogo.' }],
      }),
      PROBLEMA(422),
    );
    await propagar();
    expect(component['erro']('pontoResolucao')).toBe('Fase fora do catálogo.');
    const chaveDaPrimeira = derivado.request.headers.get('Idempotency-Key');

    component['form'].controls.pontoResolucao.setValue('INSCRICAO');
    component['criar']();
    const repetido = controller.expectOne(`${LISTA}/derivados`);
    expect(repetido.request.headers.get('Idempotency-Key'), 'depois de uma recusa, o próximo envio é outro comando').not.toBe(chaveDaPrimeira);
    repetido.flush(
      JSON.stringify({ status: 409, code: 'uniplus.configuracao.fato_candidato.codigo_ja_existe', title: 'O código já existe.' }),
      PROBLEMA(409),
    );
    await propagar();
    expect(component['erro']('codigo')).not.toBeNull();
  });
});
