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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TiposBancaPage } from './tipos-banca.page';
import { NotificationService } from '@uniplus/shared-core/notifications';

const BASE = 'http://localhost:5000';
const CRIAR_URL = `${BASE}/api/configuracao/admin/tipos-banca`;
const FASES_URL = `${BASE}/api/configuracao/fases-canonicas`;
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

  afterEach(() => {
    // Issue #713: a tela nunca deve emitir a criação de tipo de banca.
    controller.expectNone((r) => r.method === 'POST' && r.url === CRIAR_URL);
    controller.verify();
  });

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

  // Abrir a edição dispara o carregamento lazy das sugestões de "Fase típica"
  // (um GET por cursor a fases-canonicas). O `httpResource` só emite a request
  // após um tick.
  async function abrirEdicao(banca: TipoBancaDto): Promise<void> {
    component['abrirEdicao'](banca);
    await propagate();
    controller.expectOne((r) => r.url === FASES_URL).flush([]);
    await propagate();
  }

  function nomesDeBotoes(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('button')).map((b) =>
      ((b as HTMLButtonElement).textContent ?? '').trim().replace(/\s+/gu, ' '),
    );
  }

  it('CA-12: renderiza a lista de tipos de banca', async () => {
    await flushLista([bancaSeed]);
    expect(component['bancas']()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Banca de Entrevista');
    expect(fixture.nativeElement.textContent).toContain('BANCA_ENTREVISTA');
  });

  it('CA-01/CA-03: o cabeçalho não oferece a ação "Novo tipo de banca"', async () => {
    await flushLista([bancaSeed]);
    fixture.detectChanges();
    const nomes = nomesDeBotoes();
    expect(nomes).not.toContain('Novo tipo de banca');
    expect(nomes).not.toContain('Criar tipo de banca');
  });

  it('CA-02/CA-16: o estado vazio informa sem sugerir cadastro do primeiro tipo', async () => {
    await flushLista([]);
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('catálogo de tipos de banca é definido institucionalmente');
    expect(texto).not.toMatch(/cadastr\w+ o primeiro/iu);
    expect(nomesDeBotoes()).not.toContain('Novo tipo de banca');
  });

  it('CA-10/CA-11: o aviso remete ao catálogo institucional e não orienta a criar uma nova entrada', async () => {
    await flushLista([bancaSeed]);
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Códigos definidos pelo catálogo institucional');
    expect(texto).toContain('pertencem ao catálogo institucional');
    expect(texto).not.toContain('crie uma nova entrada');
  });

  it('CA-13: a busca filtra os registros carregados por código ou nome', async () => {
    const outra: TipoBancaDto = {
      ...bancaSeed,
      id: 'b3',
      codigo: 'BANCA_HETEROIDENTIFICACAO',
      nome: 'Banca de Heteroidentificação',
    };
    await flushLista([bancaSeed, outra]);

    component['termoBusca'].set('hetero');
    expect(component['bancasFiltradas']()).toEqual([outra]);
  });

  it('CA-05: o drawer só abre a partir da edição de um tipo existente', async () => {
    await flushLista([bancaSeed]);
    expect(component['formOpen']()).toBe(false);

    await abrirEdicao(bancaSeed);
    expect(component['formOpen']()).toBe(true);
    expect(component['bancaEmEdicaoId']()).toBe(bancaSeed.id);
  });

  it('CA-06: o drawer de edição usa título e ação compatíveis com a edição', async () => {
    await flushLista([bancaSeed]);
    await abrirEdicao(bancaSeed);
    fixture.detectChanges();

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Editar tipo de banca');
    expect(texto).not.toContain('Novo tipo de banca');

    const submit = fixture.nativeElement.querySelector(
      'button[form="cfg-tipo-banca-form"]',
    ) as HTMLButtonElement;
    expect(submit.textContent?.trim()).toBe('Salvar tipo de banca');
  });

  it('CA-07: código é readonly na edição e o payload de atualização não inclui o campo codigo', async () => {
    await flushLista([bancaSeed]);
    await abrirEdicao(bancaSeed);
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

  it('CA-08/CA-14: salvar a edição emite PUT e nunca POST', async () => {
    await flushLista([bancaSeed]);
    await abrirEdicao(bancaSeed);
    component['form'].controls.nome.setValue('Banca de Entrevista (2)');
    component['salvar']();

    controller.expectNone(CRIAR_URL);
    const put = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([bancaSeed]);
  });

  it('CA-14: "Fase típica" aceita texto livre não vinculado ao cadastro de fases e viaja no PUT', async () => {
    await flushLista([bancaSeed]);
    await abrirEdicao(bancaSeed);

    component['form'].controls.faseTipica.setValue('Uma fase qualquer sem correspondência');
    component['salvar']();

    const put = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);
    expect(put.request.body).toMatchObject({ faseTipica: 'Uma fase qualquer sem correspondência' });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([bancaSeed]);
  });

  it('percorre todas as páginas de fases canônicas nas sugestões de fase típica', async () => {
    await flushLista([bancaSeed]);
    component['abrirEdicao'](bancaSeed);
    await propagate();

    const pagina1 = controller.expectOne((r) => r.url === FASES_URL);
    // O teto pedido é o da API, não um número escolhido à toa: acima dele a
    // resposta é 422 e o `datalist` fica sem sugestão nenhuma.
    expect(pagina1.request.params.get('limit')).toBe(String(LIMITE_MAXIMO_API));
    pagina1.flush([faseCanonica('INSCRICAO', 'Inscrição')], {
      headers: { Link: `<${FASES_URL}?cursor=pagina-2&direction=next>; rel="next"` },
    });
    await propagate();

    const pagina2 = controller.expectOne(
      (r) => r.url === FASES_URL && r.params.get('cursor') === 'pagina-2',
    );
    pagina2.flush([faseCanonica('HOMOLOGACAO', 'Homologação')]);
    await propagate();

    expect(component['sugestoesFaseTipica']()).toEqual(['Inscrição', 'Homologação']);
  });

  it('CA-10: aviso de código do catálogo é visível mesmo com lista vazia', async () => {
    await flushLista([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Códigos definidos pelo catálogo institucional',
    );
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await flushLista([bancaSeed]);
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('table > caption');
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/gu, ' ').trim()).toBe(
      'Tipos de banca do catálogo institucional, com código e fase típica de atuação',
    );
  });

  it('CA-01/CA-03/CA-04/CA-05/CA-06: lixeira e confirmação falam em remover e identificam o tipo de banca', async () => {
    await flushLista([bancaSeed]);
    fixture.detectChanges();

    const lixeira = fixture.nativeElement.querySelector(
      'button[aria-label="Remover tipo de banca BANCA_ENTREVISTA"]',
    ) as HTMLButtonElement;

    expect(lixeira.getAttribute('data-tooltip')).toBe('Remover tipo de banca');
    expect(lixeira.querySelector('.pi-trash')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-label^="Inativar"]')).toBeNull();

    lixeira.click();
    fixture.detectChanges();

    const dialogo = fixture.nativeElement.querySelector('ui-confirm-dialog') as HTMLElement;

    expect(dialogo.querySelector('h3')?.textContent?.trim()).toBe('Remover tipo de banca');

    expect(dialogo.querySelector('.uni-dialog__body')?.textContent).toContain(
      'Deseja remover o tipo de banca BANCA_ENTREVISTA?',
    );

    expect(
      dialogo.querySelector('[data-testid="confirm-dialog-confirm"]')?.textContent?.trim(),
    ).toBe('Remover');

    expect(dialogo.textContent).not.toMatch(/inativ/iu);
  });

  it('CA-06: cancelar a remoção fecha a confirmação e não envia a requisição', async () => {
    await flushLista([bancaSeed]);
    component['pedirRemocao'](bancaSeed);
    fixture.detectChanges();

    expect(component['confirmOpen']()).toBe(true);

    const dialogo = fixture.nativeElement.querySelector('ui-confirm-dialog') as HTMLElement;
    const cancelar = dialogo.querySelector(
      '[data-testid="confirm-dialog-cancel"]',
    ) as HTMLButtonElement;

    expect(cancelar.textContent?.trim()).toBe('Cancelar');

    cancelar.click();
    fixture.detectChanges();

    expect(component['confirmOpen']()).toBe(false);
    controller.expectNone(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);
  });

  it('CA-08: confirma a remoção e atualiza a listagem', async () => {
    await flushLista([bancaSeed]);

    component['pedirRemocao'](bancaSeed);
    component['removerConfirmado']();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);

    expect(req.request.method).toBe('DELETE');

    req.flush(null, {
      status: 204,
      statusText: 'No Content',
    });

    await propagate();
    await flushLista([]);

    expect(component['bancas']()).toEqual([]);
  });

  it('CA-09: falha na remoção avisa o usuário e mantém a lista', async () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');

    await flushLista([bancaSeed]);

    component['pedirRemocao'](bancaSeed);
    component['removerConfirmado']();

    controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`).flush(
      {
        type: 'about:blank',
        title: 'Tipo de banca não encontrado',
        status: 404,
        code: 'uniplus.configuracao.tipo_banca.nao_encontrado',
      },
      {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/problem+json' },
      },
    );

    await propagate();

    expect(erroSpy).toHaveBeenCalled();
    expect(component['bancas']()).toEqual([bancaSeed]);

    controller.expectNone((r) => r.url === `${BASE}/api/configuracao/tipos-banca`);
  });

  it('CA-10: a remoção pendente não é reenviada', async () => {
    await flushLista([bancaSeed]);

    component['pedirRemocao'](bancaSeed);
    component['removerConfirmado']();

    const primeira = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`,
    );

    component['removerConfirmado']();

    controller.expectNone(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);

    primeira.flush(null, {
      status: 204,
      statusText: 'No Content',
    });

    await propagate();
    await flushLista([]);
  });
});
