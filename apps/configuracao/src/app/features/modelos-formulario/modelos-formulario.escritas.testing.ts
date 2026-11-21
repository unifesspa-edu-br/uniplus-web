import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, ModeloFormularioView } from '@uniplus/shared-data/configuracao';
import { expect, vi } from 'vitest';
import { EdicaoDosModelosFormulario } from './edicao-dos-modelos-formulario';
import { ModelosFormularioPage } from './modelos-formulario.page';

export const BASE = 'http://localhost:5000';
export const URL = `${BASE}/api/configuracao/admin/modelos-formulario`;
export const modelo: ModeloFormularioView = {
  id: 'modelo-1',
  codigo: 'INSCRICAO',
  finalidade: 'INSCRICAO',
  ativo: true,
  descritivo: { nome: 'Inscrição', descricao: null, tipoProcessoCodigo: null },
  conteudo: {
    titulo: 'Inscrição',
    etapas: [],
    itens: [],
    termos: [],
    pressupostos: [],
    grupos: [],
    documentosExigidos: [],
  },
};

export const PROBLEMA = { 'content-type': 'application/problem+json' };

export function problema(status: number, code: string, title: string, errors?: unknown[]): string {
  return JSON.stringify({ type: 'about:blank', title, status, code, errors });
}

function configurarModulo(): void {
  TestBed.configureTestingModule({
    imports: [ModelosFormularioPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: PermissoesService, useValue: { tem: () => true } },
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
    ],
  });
}

const RECUSA_DO_NOME = {
  type: 'about:blank',
  title: 'Dados inválidos',
  status: 422,
  code: 'uniplus.validacao',
  errors: [
    {
      field: 'Nome',
      code: 'uniplus.configuracao.modelo_formulario.invalido',
      message: 'Nome recusado.',
    },
  ],
};

/** A página dos modelos montada no TestBed, com o servidor simulado, e os gestos que os testes repetem. */
export class PaginaDosModelos {
  fixture!: ComponentFixture<ModelosFormularioPage>;
  edicao!: EdicaoDosModelosFormulario;
  controller!: HttpTestingController;
  private appRef!: ApplicationRef;

  async montar(): Promise<void> {
    configurarModulo();
    this.fixture = TestBed.createComponent(ModelosFormularioPage);
    this.edicao = this.fixture.debugElement.injector.get(EdicaoDosModelosFormulario);
    this.controller = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    this.appRef = TestBed.inject(ApplicationRef);
    this.fixture.detectChanges();
  }

  desmontar(): void {
    this.controller.verify();
    vi.restoreAllMocks();
  }

  /** A primeira leitura da lista e dos tipos de processo; `falha` devolve 500 na lista. */
  async carregar(falha = false, tipos: readonly object[] = []): Promise<void> {
    this.responderLista(falha);
    this.controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`)
      .flush(tipos);
    await this.propagar();
  }

  private responderLista(falha: boolean): void {
    const lista = this.controller.expectOne((r) => r.url === URL);
    if (falha) {
      lista.flush(problema(500, 'uniplus.internal.unexpected', 'Erro interno'), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: PROBLEMA,
      });
      return;
    }
    lista.flush([modelo, { ...modelo, id: 'modelo-2', codigo: 'INATIVO', ativo: false }], {
      headers: { Link: '</api/itens?cursor=abc&direction=next>; rel="next"' },
    });
  }

  async propagar(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
    this.fixture.detectChanges();
  }

  elemento<T extends HTMLElement>(seletor: string): T {
    const el = (this.fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(el, seletor).not.toBeNull();
    return el as T;
  }

  async preencher(): Promise<void> {
    this.elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await this.propagar();
    const nome = this.elemento<HTMLInputElement>('input[formcontrolname="nome"]');
    nome.value = 'Inscrição';
    nome.dispatchEvent(new Event('input'));
    const finalidade = this.elemento<HTMLSelectElement>('select[formcontrolname="finalidade"]');
    finalidade.value = 'INSCRICAO';
    finalidade.dispatchEvent(new Event('change'));
  }

  salvar(): HTMLButtonElement {
    return this.elemento('button[form="cfg-modelo-criacao"]');
  }

  enviar(): void {
    this.elemento<HTMLFormElement>('#cfg-modelo-criacao').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
  }

  /** A recusa 422 do servidor ao nome. */
  recusar(): void {
    this.controller.expectOne(URL).flush(JSON.stringify(RECUSA_DO_NOME), {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'content-type': 'application/problem+json' },
    });
  }

  nomeDoCampo(): HTMLInputElement {
    return this.elemento('input[formcontrolname="nome"]');
  }

  async editarNome(valor: string): Promise<void> {
    this.nomeDoCampo().value = valor;
    this.nomeDoCampo().dispatchEvent(new Event('input'));
    await this.propagar();
  }
}
