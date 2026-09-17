import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoEtapaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TiposEtapaPage } from './tipos-etapa.page';

const BASE = 'http://localhost:5000';

const analiseDocumental: TipoEtapaDto = {
  id: '01960000-0000-7000-0000-0000000000e1',
  codigo: 'ANALISE_DOCUMENTAL',
  nome: 'Análise Documental',
  descricao: null,
  ativo: true,
  admitePontuacao: false,
  admiteEliminacao: true,
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
  };

  async function flushLista(itens: readonly TipoEtapaDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-etapa`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(itens);
    await propagate();
  }

  it('renderiza a lista com o que cada tipo admite, em prosa', async () => {
    await flushLista([analiseDocumental]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('ANALISE_DOCUMENTAL');
    expect(fixture.nativeElement.textContent).toContain('Só eliminar');
  });

  it('cria tipo declarando o que ele admite', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    await propagate();

    component['form'].setValue({
      codigo: 'ANALISE_SOCIOECONOMICA',
      nome: 'Análise socioeconômica',
      admitePontuacao: false,
      admiteEliminacao: true,
      descricao: '',
    });
    component['salvar']();

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
    expect(component['formOpen']()).toBe(false);
  });

  it('o código é somente leitura na edição, e não vai no payload de atualização', async () => {
    await flushLista([analiseDocumental]);
    component['abrirEdicao'](analiseDocumental);
    await propagate();
    fixture.detectChanges();

    const codigoInput = fixture.nativeElement.querySelector(
      '[formcontrolname="codigo"]',
    ) as HTMLInputElement;
    expect(codigoInput.readOnly).toBe(true);

    component['form'].controls.admitePontuacao.setValue(true);
    component['salvar']();

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
    component['abrirCadastro']();
    await propagate();

    component['form'].setValue({
      codigo: 'TIPO_INERTE',
      nome: 'Tipo inerte',
      admitePontuacao: false,
      admiteEliminacao: false,
      descricao: '',
    });
    component['salvar']();

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
            message: 'O tipo de etapa deve admitir compor a nota final, eliminar candidato, ou os dois.',
          },
        ],
      },
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
    );
    await propagate();

    expect(component['erroDoCampo']('admitePontuacao')).toContain('deve admitir');
    expect(component['formOpen']()).toBe(true);
  });

  /**
   * O cadastro devolve ativos e inativos juntos. Renderizados iguais, o administrador não tem
   * como saber quais estão disponíveis para processo novo — e a ação de inativar seguia
   * oferecida para quem já estava inativo, mandando outro DELETE.
   */
  it('mostra a situação e não oferece inativar o que já está inativo', async () => {
    await flushLista([analiseDocumental, { ...provaObjetiva, ativo: false }]);
    fixture.detectChanges();

    const linhas = [...fixture.nativeElement.querySelectorAll('tbody tr')] as HTMLElement[];
    const ativa = linhas.find((l) => l.textContent?.includes('ANALISE_DOCUMENTAL'));
    const inativa = linhas.find((l) => l.textContent?.includes('PROVA_OBJETIVA'));

    expect(ativa?.textContent).toContain('Ativo');
    expect(inativa?.textContent).toContain('Inativo');

    const botoesDaInativa = [...(inativa?.querySelectorAll('button') ?? [])];

    expect(botoesDaInativa).toHaveLength(1);
    expect(botoesDaInativa[0].getAttribute('aria-label')).toBe(
      'Editar tipo de etapa: PROVA_OBJETIVA',
    );
  });

  it('inativar pede confirmação e chama o DELETE', async () => {
    await flushLista([analiseDocumental]);
    component['pedirRemocao'](analiseDocumental);
    expect(component['confirmOpen']()).toBe(true);

    component['removerConfirmado']();

    const del = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-etapa/${analiseDocumental.id}`,
    );
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
    expect(component['confirmOpen']()).toBe(false);
  });
  /**
   * O drawer é um só para todos os registros: dá para mandar salvar um tipo, fechá-lo e abrir
   * outro antes de a resposta chegar. Ela não pode então fechar o editor de quem está em tela
   * nem marcar os campos dele com um erro que é de outro tipo de etapa.
   */
  it('a resposta de um tipo não mexe no editor que já abriu outro', async () => {
    await flushLista([analiseDocumental, provaObjetiva]);

    component['abrirEdicao'](analiseDocumental);
    await propagate();
    component['form'].controls.nome.setValue('Análise Documental revisada');
    component['salvar']();

    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-etapa/${analiseDocumental.id}`,
    );

    // Com a gravação em voo, o operador abre outro registro e começa a editá-lo.
    component['abrirEdicao'](provaObjetiva);
    await propagate();
    component['form'].controls.nome.setValue('Prova Objetiva revisada');

    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['tipoEmEdicaoId']()).toBe(provaObjetiva.id);
    expect(component['form'].controls.nome.value).toBe('Prova Objetiva revisada');
    // O sucesso do primeiro relê a lista — o dado no servidor mudou de verdade.
    await flushLista([analiseDocumental, provaObjetiva]);
  });
});
