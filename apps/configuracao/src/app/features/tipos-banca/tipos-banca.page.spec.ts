import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  FaseCanonicaDto,
  TipoBancaDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposBancaPage } from './tipos-banca.page';

const BASE = 'http://localhost:5000';
const LIMITE_MAXIMO_API = 100;

const bancaSeed: TipoBancaDto = {
  id: '01960000-0000-7000-0000-0000000000b2',
  codigo: 'BANCA_ENTREVISTA',
  nome: 'Banca de Entrevista',
  faseTipica: 'Avaliação',
  descricao: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

function faseCanonica(codigo: string, nome: string): FaseCanonicaDto {
  return {
    id: `fase-${codigo}`,
    codigo,
    nome,
    descricao: null,
    donoTipico: 'CEPS',
    agrupaEtapas: false,
    permiteComplementacao: false,
    baseLegal: null,
    criadoEm: '2026-06-10T12:00:00Z',
  };
}

describe('TiposBancaPage', () => {
  let fixture: ComponentFixture<TiposBancaPage>;
  let component: TiposBancaPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposBancaPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(TiposBancaPage);
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

  async function flushLista(itens: readonly TipoBancaDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-banca`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(itens);
    await propagate();
  }

  it('CA-01: renderiza a lista de tipos de banca', async () => {
    await flushLista([bancaSeed]);
    expect(component['bancas']()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Banca de Entrevista');
    expect(fixture.nativeElement.textContent).toContain('BANCA_ENTREVISTA');
  });

  it('CA-10: banner de código imutável é visível mesmo com lista vazia', async () => {
    await flushLista([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Código imutável após criação');
  });

  it('CA-04: cria tipo de banca com código canônico válido e nome', async () => {
    await flushLista([]);
    component['abrirCadastro']();

    // Abrir o cadastro dispara o carregamento lazy das sugestões de fase típica
    // — o `httpResource` só emite a request após um tick (mesmo padrão de
    // `opcoesSuperiorResource` em unidades.page.spec.ts).
    await propagate();
    const sugestoes = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/fases-canonicas`,
    );
    sugestoes.flush([]);
    await propagate();

    component['form'].setValue({
      codigo: 'BANCA_ANALISE_DOCUMENTAL',
      nome: 'Banca de Análise Documental',
      faseTipica: 'Homologação',
      descricao: '',
    });

    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toMatchObject({
      codigo: 'BANCA_ANALISE_DOCUMENTAL',
      nome: 'Banca de Análise Documental',
      faseTipica: 'Homologação',
    });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([bancaSeed]);
    expect(component['formOpen']()).toBe(false);
  });

  it('CA-06: código é readonly na edição e o payload de atualização não inclui o campo codigo', async () => {
    await flushLista([bancaSeed]);
    component['abrirEdicao'](bancaSeed);
    await propagate();

    const sugestoes = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/fases-canonicas`,
    );
    sugestoes.flush([]);
    await propagate();

    expect(component['form'].controls.codigo.value).toBe('BANCA_ENTREVISTA');
    fixture.detectChanges();
    const codigoInput = fixture.nativeElement.querySelector(
      '[formcontrolname="codigo"]',
    ) as HTMLInputElement;
    expect(codigoInput.readOnly).toBe(true);

    component['form'].controls.nome.setValue('Banca de Entrevista (revisada)');
    component['salvar']();

    const put = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).not.toHaveProperty('codigo');
    expect(put.request.body).toMatchObject({
      id: bancaSeed.id,
      nome: 'Banca de Entrevista (revisada)',
    });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([bancaSeed]);
  });

  it('aceita "Fase típica" como texto livre não vinculado ao cadastro de fases', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    await propagate();
    const sugestoes = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/fases-canonicas`,
    );
    sugestoes.flush([]);
    await propagate();

    component['form'].setValue({
      codigo: 'BANCA_CORRECAO_REDACOES',
      nome: 'Banca de Correção',
      faseTipica: 'Uma fase qualquer sem correspondência',
      descricao: '',
    });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca`);
    expect(post.request.body).toMatchObject({ faseTipica: 'Uma fase qualquer sem correspondência' });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('percorre todas as páginas de fases canônicas nas sugestões de fase típica', async () => {
    const fasesUrl = `${BASE}/api/configuracao/fases-canonicas`;
    await flushLista([]);
    component['abrirCadastro']();
    await propagate();

    const pagina1 = controller.expectOne((r) => r.url === fasesUrl);
    // O teto pedido é o da API, não um número escolhido à toa: acima dele a
    // resposta é 422 e o `datalist` fica sem sugestão nenhuma.
    expect(pagina1.request.params.get('limit')).toBe(String(LIMITE_MAXIMO_API));
    pagina1.flush([faseCanonica('INSCRICAO', 'Inscrição')], {
      headers: { Link: `<${fasesUrl}?cursor=pagina-2&direction=next>; rel="next"` },
    });
    await propagate();

    const pagina2 = controller.expectOne(
      (r) => r.url === fasesUrl && r.params.get('cursor') === 'pagina-2',
    );
    pagina2.flush([faseCanonica('HOMOLOGACAO', 'Homologação')]);
    await propagate();

    expect(component['sugestoesFaseTipica']()).toEqual(['Inscrição', 'Homologação']);
  });

  it('código duplicado (409) é rejeitado com erro no campo sem fechar o drawer', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    await propagate();
    const sugestoes = controller.expectOne(
      (r) => r.url === `${BASE}/api/configuracao/fases-canonicas`,
    );
    sugestoes.flush([]);
    await propagate();

    component['form'].setValue({
      codigo: 'BANCA_ENTREVISTA',
      nome: 'Banca de Entrevista (dup)',
      faseTipica: '',
      descricao: '',
    });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca`);
    post.flush(
      {
        type: 'https://uniplus.dev/erros/uniplus.configuracao.tipo_banca.codigo_ja_existe',
        title: 'Já existe um tipo de banca ativo com este código',
        status: 409,
        code: 'uniplus.configuracao.tipo_banca.codigo_ja_existe',
      },
      { status: 409, statusText: 'Conflict', headers: { 'Content-Type': 'application/problem+json' } },
    );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['erroDoCampo']('codigo')).toContain(
      'Já existe um tipo de banca ativo com este código',
    );
    expect(component['formError']()).toBeNull();
  });

  it('CA-09: inativa um tipo de banca após confirmação', async () => {
    await flushLista([bancaSeed]);
    component['pedirRemocao'](bancaSeed);
    component['removerConfirmado']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
  });
});
