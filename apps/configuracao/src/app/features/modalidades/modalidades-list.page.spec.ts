import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, ModalidadeDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModalidadesListPage } from './modalidades-list.page';

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
// V retira suas vagas de AC e remaneja para AC (referencia AC como origem e destino).
const V = modalidade({
  id: 'id-v',
  codigo: 'V',
  descricao: 'PcD ampla concorrência',
  naturezaLegal: 'SUPLEMENTAR',
  composicaoVagas: 'RETIRA_DE',
  composicaoOrigem: 'AC',
  regraRemanejamento: 'DESTINO_UNICO',
  remanejamentoDestino: 'AC',
});

describe('ModalidadesListPage', () => {
  let fixture: ComponentFixture<ModalidadesListPage>;
  let component: ModalidadesListPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ModalidadesListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'modalidades', children: [] }]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(ModalidadesListPage);
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

  async function flushLista(itens: readonly ModalidadeDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === URL);
    expect(req.request.params.get('limit')).toBe('100');
    req.flush(itens);
    await propagate();
  }

  it('CA-01: renderiza código, natureza e status Ativa', async () => {
    await flushLista([AC, V]);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent as string;
    expect(component['modalidadesFiltradas']()).toHaveLength(2);
    expect(texto).toContain('AC');
    expect(texto).toContain('Ampla concorrência');
    expect(texto).toContain('Ativa');
  });

  it('CA-01: chips de natureza contam por token e filtram client-side', async () => {
    await flushLista([AC, V]);
    const chips = component['chipsNatureza']();
    expect(chips.find((c) => c.value === 'AMPLA')?.count).toBe(1);
    expect(chips.find((c) => c.value === 'SUPLEMENTAR')?.count).toBe(1);

    component['naturezaSelecionada'].set('SUPLEMENTAR');
    expect(component['modalidadesFiltradas']().map((m) => m.codigo)).toEqual(['V']);
  });

  it('CA-01: busca casa código e descrição', async () => {
    await flushLista([AC, V]);
    component['busca'].set('pcd');
    expect(component['modalidadesFiltradas']().map((m) => m.codigo)).toEqual(['V']);
  });

  it('CA-01: mapa reverso lista quem referencia a modalidade (AC referenciada por V)', async () => {
    await flushLista([AC, V]);
    expect(component['referenciadaPor']('AC').map((m) => m.codigo)).toEqual(['V']);
    expect(component['referenciadaPor']('V')).toEqual([]);
  });

  it('ModalidadeRemocaoDialog_BloqueiaQuandoReferenciada: sem DELETE quando há dependente', async () => {
    await flushLista([AC, V]);
    component['pedirRemocao'](AC);
    expect(component['remocaoBloqueada']()).toBe(true);
    component['removerConfirmado']();
    controller.expectNone(`${BASE}/api/configuracao/admin/modalidades/${AC.id}`);
  });

  it('ModalidadeRemocaoDialog_SoftDeleteQuandoLivre: DELETE e recarrega', async () => {
    await flushLista([AC, V]);
    component['pedirRemocao'](V);
    expect(component['remocaoBloqueada']()).toBe(false);
    component['removerConfirmado']();
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${V.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    expect(component['dialogAberto']()).toBe(false);
    await flushLista([AC]);
  });

  it('ModalidadeRemocaoDialog_409Servidor: 409 mantém bloqueio autoritativo', async () => {
    await flushLista([AC, V]);
    component['pedirRemocao'](V);
    component['removerConfirmado']();
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/modalidades/${V.id}`);
    req.flush(
      { type: 'about:blank', title: 'Conflito', status: 409, code: 'Modalidade.RemocaoBloqueadaPorReferencia' },
      { status: 409, statusText: 'Conflict' },
    );
    await propagate();
    expect(component['bloqueioServidor']()).toBe(true);
    expect(component['remocaoBloqueada']()).toBe(true);
    // A mensagem do servidor é capturada para exibição quando o referente não está na página.
    expect(component['mensagemBloqueioServidor']()).toBeTruthy();
    await flushLista([AC, V]);
  });
});
