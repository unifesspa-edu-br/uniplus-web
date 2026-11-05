import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoEtapaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposEtapaPage } from './tipos-etapa.page';
import { TiposEtapaStore } from './tipos-etapa.store';

const BASE = 'http://localhost:5000';

const analiseDocumental: TipoEtapaDto = {
  id: '01960000-0000-7000-0000-0000000000e1',
  codigo: 'ANALISE_DOCUMENTAL',
  nome: 'Análise Documental',
  descricao: null,
  ativo: true,
  admitePontuacao: false,
  admiteEliminacao: true,
  notaDeOrigemNoEnem: false,
  criadoEm: '2026-08-11T00:00:00Z',
};

const provaObjetiva: TipoEtapaDto = {
  id: '01960000-0000-7000-0000-0000000000e2',
  codigo: 'PROVA_OBJETIVA',
  nome: 'Prova Objetiva',
  descricao: null,
  ativo: true,
  admitePontuacao: true,
  admiteEliminacao: true,
  notaDeOrigemNoEnem: false,
  criadoEm: '2026-08-11T00:00:00Z',
};

describe('TiposEtapaPage', () => {
  let fixture: ComponentFixture<TiposEtapaPage>;
  let component: TiposEtapaPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposEtapaPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(TiposEtapaPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  };

  async function flushLista(itens: readonly TipoEtapaDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-etapa`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(itens);
    await propagate();
  }

  /**
   * As ações são botões de ícone: não há rótulo visível para procurar, e a posição
   * dentro da célula muda quando a linha ganha outra ação. O nome acessível é o que
   * identifica cada uma, e é por ele que o operador de leitor de tela a encontra.
   */
  function botaoDeAcao(linha: Element, acao: string): HTMLButtonElement {
    return linha.querySelector(
      `td.table-responsive__actions button[aria-label^="${acao} tipo de etapa "]`,
    ) as HTMLButtonElement;
  }

  function linhaDe(codigo: string): HTMLElement {
    const linhas = [...fixture.nativeElement.querySelectorAll('tbody tr')] as HTMLElement[];
    const linha = linhas.find((l) => l.textContent?.includes(codigo));
    expect(linha, `linha de ${codigo}`).toBeTruthy();
    return linha as HTMLElement;
  }

  it('renderiza a lista com o que cada tipo admite, em prosa', async () => {
    await flushLista([analiseDocumental]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('ANALISE_DOCUMENTAL');
    expect(fixture.nativeElement.textContent).toContain('Só eliminar');
  });

  it('cria tipo declarando o que ele admite', async () => {
    await flushLista([]);
    component['edicao'].abrirCadastro();
    await propagate();

    component['edicao'].form.setValue({
      codigo: 'ANALISE_SOCIOECONOMICA',
      nome: 'Análise socioeconômica',
      admitePontuacao: false,
      admiteEliminacao: true,
      descricao: '',
    });
    component['edicao'].salvar();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-etapa`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toMatchObject({
      codigo: 'ANALISE_SOCIOECONOMICA',
      nome: 'Análise socioeconômica',
      admitePontuacao: false,
      admiteEliminacao: true,
    });
    post.flush('novo-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([analiseDocumental]);
    expect(component['edicao'].formOpen()).toBe(false);
  });

  it('o código é somente leitura na edição, e não vai no payload de atualização', async () => {
    await flushLista([analiseDocumental]);
    component['edicao'].abrirEdicao(analiseDocumental);
    await propagate();
    fixture.detectChanges();

    const codigoInput = fixture.nativeElement.querySelector(
      '[formcontrolname="codigo"]',
    ) as HTMLInputElement;
    expect(codigoInput.readOnly).toBe(true);

    component['edicao'].form.controls.admitePontuacao.setValue(true);
    component['edicao'].salvar();

    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-etapa/${analiseDocumental.id}`,
    );
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).not.toHaveProperty('codigo');
    expect(put.request.body).toMatchObject({ admitePontuacao: true, admiteEliminacao: true });
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([analiseDocumental]);
  });

  /**
   * A regra de "ao menos um" vive no agregado, e a recusa dele nomeia o campo. Exibi-la no
   * campo é o que evita a segunda fonte da mesma regra, que envelheceria à parte.
   */
  it('a recusa do servidor por nenhum caráter admitido aparece no campo', async () => {
    await flushLista([]);
    component['edicao'].abrirCadastro();
    await propagate();

    component['edicao'].form.setValue({
      codigo: 'TIPO_INERTE',
      nome: 'Tipo inerte',
      admitePontuacao: false,
      admiteEliminacao: false,
      descricao: '',
    });
    component['edicao'].salvar();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-etapa`);
    post.flush(
      {
        type: 'about:blank',
        title: 'Tipo de etapa não admite nenhum caráter de etapa',
        status: 422,
        code: 'uniplus.configuracao.tipo_etapa.sem_carater_admitido',
        errors: [
          {
            field: 'admitePontuacao',
            code: 'uniplus.configuracao.tipo_etapa.sem_carater_admitido',
            message:
              'O tipo de etapa deve admitir compor a nota final, eliminar candidato, ou os dois.',
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

    expect(fixture.nativeElement.textContent).toContain('deve admitir');
    expect(component['edicao'].formOpen()).toBe(true);
  });

  /**
   * O cadastro devolve ativos e inativos juntos. Renderizados iguais, o administrador não tem
   * como saber quais estão disponíveis para processo novo — e a ação de inativar seguia
   * oferecida para quem já estava inativo, mandando outro DELETE.
   */
  it('mostra a situação e não oferece inativar o que já está inativo', async () => {
    await flushLista([analiseDocumental, { ...provaObjetiva, ativo: false }]);
    fixture.detectChanges();

    const ativa = linhaDe('ANALISE_DOCUMENTAL');
    const inativa = linhaDe('PROVA_OBJETIVA');

    expect(ativa.textContent).toContain('Ativo');
    expect(inativa.textContent).toContain('Inativo');

    expect(botaoDeAcao(ativa, 'Inativar')).toBeTruthy();
    expect(botaoDeAcao(inativa, 'Inativar')).toBeNull();
    expect(botaoDeAcao(inativa, 'Editar').getAttribute('aria-label')).toBe(
      'Editar tipo de etapa PROVA_OBJETIVA',
    );
  });

  /**
   * As duas ações delegam ao `ui-icon-button`, que emite `(triggered)`. Acionar pela instância não
   * exercita essa ligação: sem clicar no DOM, um binding trocado ou ausente passa por
   * lint, teste e build sem nada acusar.
   */
  it('o ícone de editar abre a edição do tipo daquela linha', async () => {
    await flushLista([analiseDocumental, provaObjetiva]);
    fixture.detectChanges();

    botaoDeAcao(linhaDe('PROVA_OBJETIVA'), 'Editar').click();
    await propagate();

    expect(component['edicao'].formOpen()).toBe(true);
    expect(component['edicao'].form.controls.codigo.value).toBe('PROVA_OBJETIVA');
  });

  it('o ícone de inativar pede confirmação para o tipo daquela linha', async () => {
    await flushLista([analiseDocumental, provaObjetiva]);
    fixture.detectChanges();

    botaoDeAcao(linhaDe('PROVA_OBJETIVA'), 'Inativar').click();
    await propagate();

    expect(component['edicao'].confirmOpen()).toBe(true);
    expect(component['edicao'].tipoParaRemover()?.codigo).toBe('PROVA_OBJETIVA');
  });

  /**
   * Sem rótulo visível, o glifo é a única pista de qual ação é qual para quem enxerga,
   * e a dica é o que a nomeia no hover e no foco. Um erro de digitação em qualquer um
   * dos dois rende um botão mudo que nenhum outro teste percebe.
   */
  it('cada ação mostra seu ícone e sua dica', async () => {
    await flushLista([analiseDocumental]);
    fixture.detectChanges();

    const linha = linhaDe('ANALISE_DOCUMENTAL');
    const editar = botaoDeAcao(linha, 'Editar');
    const inativar = botaoDeAcao(linha, 'Inativar');

    expect(editar.querySelector('i')?.className).toContain('pi-pencil');
    expect(editar.getAttribute('data-tooltip')).toBe('Editar tipo de etapa');
    expect(inativar.querySelector('i')?.className).toContain('pi-power-off');
    expect(inativar.getAttribute('data-tooltip')).toBe('Inativar tipo de etapa');
  });

  it('as ações ficam indisponíveis enquanto a lista recarrega', async () => {
    await flushLista([analiseDocumental]);
    fixture.detectChanges();

    const linha = linhaDe('ANALISE_DOCUMENTAL');
    expect(botaoDeAcao(linha, 'Editar').getAttribute('aria-disabled')).toBe('false');
    expect(botaoDeAcao(linha, 'Inativar').getAttribute('aria-disabled')).toBe('false');

    component['tentarNovamente']();
    await propagate();
    fixture.detectChanges();

    const recarregando = linhaDe('ANALISE_DOCUMENTAL');
    expect(botaoDeAcao(recarregando, 'Editar').getAttribute('aria-disabled')).toBe('true');
    expect(botaoDeAcao(recarregando, 'Inativar').getAttribute('aria-disabled')).toBe('true');

    // Encerra o GET em voo para o controller.verify() do afterEach.
    await flushLista([analiseDocumental]);
  });

  it('inativar pede confirmação e chama o DELETE', async () => {
    await flushLista([analiseDocumental]);
    component['edicao'].pedirRemocao(analiseDocumental);
    expect(component['edicao'].confirmOpen()).toBe(true);

    component['edicao'].removerConfirmado();

    const del = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-etapa/${analiseDocumental.id}`,
    );
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
    expect(component['edicao'].confirmOpen()).toBe(false);
  });
  it('bloqueia a abertura de outro editor durante a gravação', async () => {
    await flushLista([analiseDocumental, provaObjetiva]);

    component['edicao'].abrirEdicao(analiseDocumental);
    await propagate();
    component['edicao'].form.controls.nome.setValue('Análise Documental revisada');
    component['edicao'].salvar();

    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-etapa/${analiseDocumental.id}`,
    );

    component['edicao'].abrirEdicao(provaObjetiva);
    await propagate();
    expect(component['edicao'].tipoEmEdicaoId()).toBe(analiseDocumental.id);
    component['edicao'].fechar();
    expect(component['edicao'].formOpen()).toBe(true);

    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    expect(component['edicao'].formOpen()).toBe(false);
    expect(component['edicao'].tipoEmEdicaoId()).toBe(analiseDocumental.id);
    expect(component['edicao'].form.controls.nome.value).toBe('Análise Documental revisada');
    expect(component['edicao'].gravando()).toBe(true);
    component['edicao'].abrirEdicao(provaObjetiva);
    expect(component['edicao'].formOpen()).toBe(false);
    // O sucesso do primeiro relê a lista — o dado no servidor mudou de verdade.
    await flushLista([analiseDocumental, provaObjetiva]);
    expect(component['edicao'].gravando()).toBe(false);
  });
  it('mantém a trava após falha da recarga até uma nova leitura bem-sucedida', async () => {
    await flushLista([analiseDocumental]);
    component['edicao'].pedirRemocao(analiseDocumental);
    component['edicao'].removerConfirmado();
    controller
      .expectOne(`${BASE}/api/configuracao/admin/tipos-etapa/${analiseDocumental.id}`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-etapa`)
      .flush({ title: 'Falha', status: 500 }, { status: 500, statusText: 'Erro' });
    await propagate();
    expect(component['edicao'].gravando()).toBe(true);
    component['tentarNovamente']();
    await propagate();
    await flushLista([]);
    expect(component['edicao'].gravando()).toBe(false);
  });

  it('foca o campo recusado pelo servidor', async () => {
    await flushLista([]);
    component['edicao'].abrirCadastro();
    component['edicao'].form.patchValue({ codigo: 'PROVA', nome: 'Prova' });
    await propagate();
    component['edicao'].salvar();
    await propagate();
    controller.expectOne(`${BASE}/api/configuracao/admin/tipos-etapa`).flush(
      {
        type: 'about:blank',
        title: 'Recusa',
        status: 422,
        code: 'uniplus.configuracao.tipo_etapa.nome_invalido',
        errors: [
          {
            field: 'nome',
            code: 'uniplus.configuracao.tipo_etapa.nome_invalido',
            message: 'Nome recusado',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Recusa',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();
    await propagate();
    expect(component['edicao'].form.controls.nome.errors).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('label.is-error input[formcontrolname=nome]'),
    ).toBeTruthy();
    expect(document.activeElement?.getAttribute('formcontrolname')).toBe('nome');
  });

  it('filtra a página atual e volta à primeira página ao recarregar', async () => {
    const store = fixture.debugElement.injector.get(TiposEtapaStore);
    const primeira = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-etapa`);
    primeira.flush([analiseDocumental, provaObjetiva], {
      headers: { Link: '</api/tipos-etapa?cursor=abc&direction=next>; rel="next"' },
    });
    await propagate();

    store.termoBusca.set('objetiva');
    expect(store.tiposFiltrados()).toEqual([provaObjetiva]);
    store.proximaPagina();
    await propagate();
    const proxima = controller.expectOne((r) => r.params.get('cursor') === 'abc');
    expect(proxima.request.params.get('direction')).toBe('next');
    proxima.flush([analiseDocumental]);
    await propagate();
    expect(store.tiposFiltrados()).toEqual([]);

    store.recarregar();
    await propagate();
    await flushLista([provaObjetiva]);
    expect(store.tiposFiltrados()).toEqual([provaObjetiva]);
  });
});
