import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import {
  CONFIGURACAO_BASE_PATH,
  CondicaoAtendimentoDto,
} from '@uniplus/shared-data/configuracao';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CondicoesAtendimentoListPage } from './condicoes-atendimento-list';

const BASE = 'http://localhost:5000';

const condicao_atendimento_seed: CondicaoAtendimentoDto = {
  'id': '019f3cbf-adda-7f7b-b8f5-f69bc1505cd7',
  codigo: 'PCD',
  nome: 'Pcd',
  descricao: 'LBI (Lei 13.146/2015), art. 30',
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};

describe('CondicoesAtendimentoListPage', () => {
  let fixture: ComponentFixture<CondicoesAtendimentoListPage>;
  let component: CondicoesAtendimentoListPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CondicoesAtendimentoListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(CondicoesAtendimentoListPage);
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

  async function flushLista(itens: readonly CondicaoAtendimentoDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/condicoes-atendimento`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(itens);
    await propagate();
  }

  it('drawer mostra empty-state quando condições não tem ofertas vivas', async () => {
    await flushLista([]);

    await propagate();

    expect(component['condicoes']()).toHaveLength(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhuma condição de atendimento carregada');
  });

  it('renderiza a lista de condições de atendimento', async () => {
    await flushLista([condicao_atendimento_seed]);
    expect(component['condicoes']()).toHaveLength(1);

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('PCD');
    expect(fixture.nativeElement.textContent).toContain('Pcd');
    expect(fixture.nativeElement.textContent).toContain('LBI (Lei 13.146/2015), art. 30');
  });

  it('cria condição de atendimento com código único, nome, descrição válidos', async () => {
      await flushLista([]);

      component['abrirDrawerCriacao']();
      component['form'].setValue({
        codigo: 'PCD',
        nome: 'Pcd',
        descricao: 'LBI (Lei 13.146/2015), art. 30',
      });
      const key = component['idempotencyKeyAtual']();

      component['salvar']();

      const post = controller.expectOne(`${BASE}/api/configuracao/admin/condicoes-atendimento`);
      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBe(key);
      expect(post.request.body).toMatchObject({
        codigo: 'PCD',
        nome: 'Pcd',
        descricao: 'LBI (Lei 13.146/2015), art. 30'
      });
      post.flush('new-id', { status: 201, statusText: 'Created' });
      await propagate();

      await flushLista([condicao_atendimento_seed]);
      expect(component['formOpen']()).toBe(false);
    });

    it('desablita o botão de inativação quando o código é "PCD"', async () => {
    await flushLista([condicao_atendimento_seed]);
    expect(component['condicoes']()).toHaveLength(1);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('PCD');
    expect(fixture.nativeElement.textContent).toContain('Pcd');
    expect(fixture.nativeElement.textContent).toContain('LBI (Lei 13.146/2015), art. 30');
  });
});
