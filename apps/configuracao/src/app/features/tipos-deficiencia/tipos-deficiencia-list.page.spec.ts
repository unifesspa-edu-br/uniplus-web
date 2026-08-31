import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import {
  CONFIGURACAO_BASE_PATH,
  TipoDeficienciaDto,
} from '@uniplus/shared-data/configuracao';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  sugerirCodigoDeTipoDeficiencia,
  TiposDeficienciaListPage,
} from './tipos-deficiencia-list.page';

const BASE = 'http://localhost:5000';
const TIPO_DEFICIENCIA_ID = '019f41cf-69fd-759a-ac6d-09acabc1b027';
const tipoDeficienciaSeed: TipoDeficienciaDto = {
  id: TIPO_DEFICIENCIA_ID,
  codigo: 'VISUAL',
  nome: 'Visual',
  permanente: null,
  descricao: 'Inclui baixa visão e cegueira',
  criadoEm: '2026-07-07T13:23:42.707136+00:00',
};

describe('TiposDeficienciaListPage', () => {
  let fixture: ComponentFixture<TiposDeficienciaListPage>;
  let component: TiposDeficienciaListPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposDeficienciaListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(TiposDeficienciaListPage);
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

  async function flushLista(items: readonly TipoDeficienciaDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-deficiencia`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(items);
    await propagate();
  }

  // Pós-mutação, `recarregar()` só dá reload no resource da lista principal —
  // os lookups de Tipos de Deficiência já estão em cache e não recarregam.
  async function flushRecarregarLista(items: readonly TipoDeficienciaDto[]): Promise<void> {
    await propagate();
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-deficiencia`)
      .flush(items);
    await propagate();
  }

  function getSalvarOuEditarButtonEl() {
    return fixture.nativeElement.querySelector(
      'button[form="cfg-tipo-deficiencia-form"]',
    ) as HTMLButtonElement;
  }

  function getInativarButtonEl(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      'td.table-responsive__actions > button:last-child',
    ) as HTMLButtonElement;
  }

  function getEditarButtonEl(): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      'td.table-responsive__actions > button:first-child',
    ) as HTMLButtonElement;
  }

  /**
   * Escreve num campo como o operador escreveria: um controle por vez, marcado
   * como sujo. `form.setValue` em bloco não representa digitação — atualiza todos
   * os controles de uma vez, na ordem das chaves do objeto.
   */
  function digitar(campo: 'nome' | 'codigo' | 'descricao', valor: string): void {
    const control = component['form'].controls[campo];
    control.setValue(valor);
    control.markAsDirty();
    control.markAsTouched();
  }

  it('drawer mostra empty-state quando tipos de deficiência não tem ofertas vivas', async () => {
    await flushLista([]);

    await propagate();

    expect(component['tiposDeficiencia']()).toHaveLength(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nenhum tipo de deficiência carregado');
  });

  it('busca sem resultado mostra o empty-state de filtro, não o de lista vazia', async () => {
    await flushLista([tipoDeficienciaSeed]);

    component['termoBusca'].set('tipo-deficiencia-inexistente');
    fixture.detectChanges();

    expect(component['tiposDeficienciaFiltrados']()).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('Nenhum tipo de deficiência encontrado');
    expect(fixture.nativeElement.textContent).toContain('Ajuste a busca para ver resultados.');
    expect(fixture.nativeElement.textContent).not.toContain('Nenhum tipo de deficiência carregado');
  });

  it('renderiza a lista de tipos de deficiência', async () => {
    await flushLista([tipoDeficienciaSeed]);
    expect(component['tiposDeficiencia']()).toHaveLength(1);

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Visual');
    expect(fixture.nativeElement.textContent).toContain('Inclui baixa visão e cegueira');
  });

  it('descrição em branco barra o envio e não vira null no payload', async () => {
    await flushLista([]);

    component['abrirDrawerCriacao']();
    component['form'].setValue({ codigo: 'VISUAL', nome: 'Visual', descricao: '   ' });

    // O contrato passou a exigir descrição não vazia; antes o formulário
    // enviava `null` e o backend recusava com 422.
    component['salvar']();
    controller.expectNone(`${BASE}/api/configuracao/admin/tipos-deficiencia`);

    component['form'].controls.descricao.setValue('Inclui baixa visão e cegueira');
    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-deficiencia`);
    expect(post.request.body).toMatchObject({ descricao: 'Inclui baixa visão e cegueira' });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('cria tipo de deficiência com nome único, descrição válidos', async () => {
      await flushLista([]);

      component['abrirDrawerCriacao']();
      component['form'].setValue({
        codigo: 'VISUAL',
        nome: 'Visual',
        descricao: 'Inclui baixa visão e cegueira',
      });
      const key = component['idempotencyKeyAtual']();

      component['salvar']();

      const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-deficiencia`);
      expect(post.request.method).toBe('POST');
      expect(post.request.headers.get('Idempotency-Key')).toBe(key);
      expect(post.request.body).toMatchObject({
        nome: 'Visual',
        descricao: 'Inclui baixa visão e cegueira',
      });
      post.flush('new-id', { status: 201, statusText: 'Created' });
      await propagate();

      expect(component['formOpen']()).toBe(false);
      expect(component['modo']()).toBe('criar');
      await flushLista([tipoDeficienciaSeed]);
  });

  it('simula cenário que a primeira requisição falha e tenta novamente com sucesso', async () => {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-deficiencia`)
    req.flush(null, { status: 500, statusText: 'Error' });
    await propagate();
    const tentarNovamenteButtonEl = fixture.nativeElement.querySelector(
      '.cfg-campi__retry > button',
    ) as HTMLButtonElement;
    expect(tentarNovamenteButtonEl).toBeTruthy();

    tentarNovamenteButtonEl.dispatchEvent(new Event('click'));
    fixture.detectChanges();
    await flushRecarregarLista([tipoDeficienciaSeed]);
    expect(component['tiposDeficiencia']()).toHaveLength(1);
  });

  it('bloqueia botão de salvar quando os campos obrigatórios estão vazios', async () => {
    await flushLista([]);
    component['abrirDrawerCriacao']();
    fixture.detectChanges();

    const submit = getSalvarOuEditarButtonEl();
    component['salvar']();

    expect(submit.disabled).toBe(true);
    controller.expectNone(`${BASE}/api/configuracao/admin/tipos-deficiencia`);
    expect(component['modo']()).toBe('criar');
  });

  it('nome duplicado (409) é mapeado ao campo Nome sem fechar o drawer', async () => {
    await flushLista([]);

    component['abrirDrawerCriacao']();
    component['form'].setValue({
      codigo: 'VISUAL',
      nome: 'Visual',
      // Descrição passou a ser obrigatória no contrato: sem valor, o submit
      // nem chegaria a disparar a request que este teste inspeciona.
      descricao: 'Inclui baixa visão e cegueira',
    });
    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-deficiencia`);
      post.flush(
        JSON.stringify({
          type: 'https://uniplus.dev/erros/uniplus.configuracao.tipo_deficiencia.nome_ja_existe',
          title: 'Já existe um tipo de deficiência ativo com este nome',
          status: 409,
          code: 'uniplus.configuracao.tipo_deficiencia.nome_ja_existe',
          traceId: 'test-trace',
        }),
        {
          status: 409,
          statusText: 'Conflict',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['form'].controls.nome.errors?.['backend']).toBeTruthy();
  });

  it('filtra a lista client-side por nome', async () => {
    const outroTipoDeficiencia: TipoDeficienciaDto = {
      ...tipoDeficienciaSeed,
      id: '2',
      codigo: 'AUDITIVA',
      nome: 'Auditiva',
      descricao: 'inclui surdez e surdocegueira.'
    };
    await flushLista([tipoDeficienciaSeed, outroTipoDeficiencia,]);

    component['termoBusca'].set('Visual');
    fixture.detectChanges();

    expect(component['tiposDeficienciaFiltrados']()).toHaveLength(1);
    expect(component['tiposDeficienciaFiltrados']()[0].nome).toBe('Visual');
  });

  it('edita campos de nome', async () => {
      const NOVO_NOME = 'Visual e Auditiva';
      const tipo_deficiencia: TipoDeficienciaDto = {
        ...tipoDeficienciaSeed,
        nome: NOVO_NOME,
      };

      await flushLista([tipoDeficienciaSeed]);

      component['abrirEdicao'](tipoDeficienciaSeed);
      await propagate();

      component['form'].controls.nome.setValue(NOVO_NOME);
      component['salvar']();

      const put = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-deficiencia/${TIPO_DEFICIENCIA_ID}`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.body.nome).toBe(NOVO_NOME);
      put.flush(null, { status: 204, statusText: 'No Content' });
      await flushRecarregarLista([tipo_deficiencia]);
    });
  it('desabilita as ações da linha (Editar e Inativar) durante a recarga da lista', async () => {
    // Estado estável: lista carregada, nada em voo — os botões da linha estão habilitados.
    await flushLista([tipoDeficienciaSeed]);
    fixture.detectChanges();
    expect(component['loading']()).toBe(false);
    expect(getEditarButtonEl().disabled).toBe(false);
    expect(getInativarButtonEl().disabled).toBe(false);

    // Recarga real: reload() deixa loading()=true com o GET em voo, preservando a linha.
    component['tentarNovamente']();
    await propagate();
    fixture.detectChanges();
    expect(component['loading']()).toBe(true);
    expect(getEditarButtonEl().disabled).toBe(true);
    expect(getInativarButtonEl().disabled).toBe(true);

    // Encerra o GET pendente para o controller.verify() do afterEach.
    controller
      .expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-deficiencia`)
      .flush([tipoDeficienciaSeed]);
    await propagate();
  });

  it('código duplicado (409) é mapeado ao campo código sem fechar o drawer', async () => {
    await flushLista([tipoDeficienciaSeed]);

    component['abrirDrawerCriacao']();
    component['form'].setValue({
      codigo: 'VISUAL',
      nome: 'Deficiência Visual',
      descricao: 'Inclui baixa visão e cegueira',
    });
    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-deficiencia`);
    post.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.tipo_deficiencia.codigo_ja_existe',
        title: 'Já existe um tipo de deficiência ativo com este código',
        status: 409,
        code: 'uniplus.configuracao.tipo_deficiencia.codigo_ja_existe',
        traceId: 'test-trace',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['form'].controls.codigo.errors?.['backend']).toBeTruthy();
  });

  /**
   * `aria-invalid` diz que há erro; sozinho, não diz **qual**. WCAG 2.1 AA
   * (3.3.1 Identificação de Erro) pede que a mensagem esteja associada ao
   * campo, e é o `aria-describedby` que faz o leitor de tela lê-la ao focar.
   */
  it('associa a dica e a mensagem de erro ao campo de código para leitor de tela', async () => {
    await flushLista([tipoDeficienciaSeed]);
    component['abrirDrawerCriacao']();
    await propagate();
    fixture.detectChanges();

    const campoCodigo: HTMLInputElement = fixture.nativeElement.querySelector(
      'input[formControlName="codigo"]',
    );

    // Sem erro, o campo aponta só para a dica.
    expect(campoCodigo.getAttribute('aria-describedby')).toBe('cfg-td-codigo-dica');
    expect(campoCodigo.getAttribute('aria-invalid')).toBeNull();
    expect(fixture.nativeElement.querySelector('#cfg-td-codigo-dica')).not.toBeNull();

    digitar('codigo', '1VISUAL');
    digitar('nome', 'Deficiência Visual');
    digitar('descricao', 'Inclui baixa visão e cegueira');
    component['salvar']();
    await propagate();
    fixture.detectChanges();

    // Com erro, passa a apontar também para a mensagem — e ela existe no DOM
    // com o id anunciado, senão o leitor de tela não lê nada.
    expect(campoCodigo.getAttribute('aria-invalid')).toBe('true');
    expect(campoCodigo.getAttribute('aria-describedby')).toBe(
      'cfg-td-codigo-dica cfg-td-codigo-erro',
    );
    const mensagem: HTMLElement = fixture.nativeElement.querySelector('#cfg-td-codigo-erro');
    expect(mensagem.textContent?.trim()).not.toBe('');
  });

  it('previne submeter código inválido sem fechar o drawer', async () => {
    await flushLista([tipoDeficienciaSeed]);

    component['abrirDrawerCriacao']();
    component['form'].setValue({
      codigo: '1VISUAL',
      nome: 'Deficiência Visual',
      descricao: 'Inclui baixa visão e cegueira',
    });
    component['salvar']();
    controller.expectNone(`${BASE}/api/configuracao/admin/tipos-deficiencia`);
  });

  it('sugere o código a partir do nome na criação', async () => {
    await flushLista([tipoDeficienciaSeed]);

    component['abrirDrawerCriacao']();
    digitar('nome', 'Deficiência visual');

    expect(component['form'].controls.codigo.value).toBe('DEFICIENCIA_VISUAL');
  });

  it('sugestão acompanha o nome até o operador escrever o próprio código', async () => {
    await flushLista([tipoDeficienciaSeed]);

    component['abrirDrawerCriacao']();
    digitar('nome', 'Deficiência');
    // Enquanto o campo tem apenas o que a sugestão pôs, ela continua acompanhando.
    digitar('nome', 'Deficiência visual');
    expect(component['form'].controls.codigo.value).toBe('DEFICIENCIA_VISUAL');

    digitar('codigo', 'DEF_VISUAL');
    digitar('nome', 'Deficiência visual total');

    expect(component['form'].controls.codigo.value).toBe('DEF_VISUAL');
  });

  it('edição carrega o código salvo e a sugestão nunca o substitui', async () => {
    await flushLista([tipoDeficienciaSeed]);

    component['abrirEdicao'](tipoDeficienciaSeed);
    expect(component['form'].controls.codigo.value).toBe('VISUAL');

    digitar('nome', 'Deficiência visual e auditiva');

    expect(component['form'].controls.codigo.value).toBe('VISUAL');
  });

  it('envia o código em caixa alta mesmo digitado em caixa baixa', async () => {
    await flushLista([]);

    component['abrirDrawerCriacao']();
    digitar('nome', 'Visual');
    digitar('descricao', 'Inclui baixa visão e cegueira');
    digitar('codigo', 'def_visual');

    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-deficiencia`);
    expect(post.request.body.codigo).toBe('DEF_VISUAL');
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('422 acumulado ancora um erro em cada campo, não só no primeiro', async () => {
    await flushLista([]);

    component['abrirDrawerCriacao']();
    digitar('nome', 'Visual');
    digitar('descricao', 'Inclui baixa visão e cegueira');
    digitar('codigo', 'VISUAL');
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-deficiencia`);
    // O backend acumula toda violação em `errors[]` e repete só a primeira na raiz.
    post.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.tipo_deficiencia.codigo_formato_invalido',
        title: 'Código do tipo de deficiência deve iniciar com letra maiúscula',
        status: 422,
        code: 'uniplus.configuracao.tipo_deficiencia.codigo_formato_invalido',
        traceId: 'test-trace',
        errors: [
          {
            field: 'codigo',
            code: 'uniplus.configuracao.tipo_deficiencia.codigo_formato_invalido',
            message: 'Código do tipo de deficiência deve iniciar com letra maiúscula.',
          },
          {
            field: 'descricao',
            code: 'uniplus.configuracao.tipo_deficiencia.descricao_obrigatoria',
            message: 'Descrição do tipo de deficiência é obrigatória.',
          },
        ],
      }),
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['form'].controls.codigo.errors?.['backend']).toBeTruthy();
    expect(component['form'].controls.descricao.errors?.['backend']).toBeTruthy();
  });

  it('filtra a lista client-side por código', async () => {
    const outroTipoDeficiencia: TipoDeficienciaDto = {
      ...tipoDeficienciaSeed,
      id: '2',
      codigo: 'AUDITIVA',
      nome: 'Auditiva',
    };
    await flushLista([tipoDeficienciaSeed, outroTipoDeficiencia]);

    component['termoBusca'].set('AUDITIVA');
    fixture.detectChanges();

    expect(component['tiposDeficienciaFiltrados']()).toHaveLength(1);
    expect(component['tiposDeficienciaFiltrados']()[0].codigo).toBe('AUDITIVA');
  });

  it('atualização preserva a classificação de permanência do registro', async () => {
    const tipoPermanente: TipoDeficienciaDto = { ...tipoDeficienciaSeed, permanente: true };
    await flushLista([tipoPermanente]);

    component['abrirEdicao'](tipoPermanente);
    await propagate();
    digitar('nome', 'Visual e auditiva');
    component['salvar']();

    const put = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-deficiencia/${TIPO_DEFICIENCIA_ID}`,
    );
    // O PUT substitui o registro inteiro: omitir `permanente` apagaria a
    // classificação a cada edição de nome.
    expect(put.request.body.permanente).toBe(true);
    put.flush(null, { status: 204, statusText: 'No Content' });
    await flushRecarregarLista([tipoPermanente]);
  });

  it('conflito de processamento preserva a Idempotency-Key para o retry', async () => {
    await flushLista([]);

    component['abrirDrawerCriacao']();
    digitar('nome', 'Visual');
    digitar('descricao', 'Inclui baixa visão e cegueira');
    const chave = component['idempotencyKeyAtual']();

    component['salvar']();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-deficiencia`);
    post.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.idempotency.processing_conflict',
        title: 'Requisição anterior com a mesma chave ainda em processamento',
        status: 409,
        code: 'uniplus.idempotency.processing_conflict',
        traceId: 'test-trace',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    // O backend pede retry do MESMO comando: chave nova viraria um comando novo.
    expect(component['idempotencyKeyAtual']()).toBe(chave);
  });
});

describe('sugerirCodigoDeTipoDeficiencia', () => {
  it('remove diacríticos e sobe para caixa alta', () => {
    expect(sugerirCodigoDeTipoDeficiencia('Deficiência visual')).toBe('DEFICIENCIA_VISUAL');
  });

  it('colapsa pontuação em sublinhado e apara as pontas', () => {
    expect(sugerirCodigoDeTipoDeficiencia('  Surdez — parcial/total!  ')).toBe(
      'SURDEZ_PARCIAL_TOTAL',
    );
  });

  it('não passa do tamanho aceito pelo backend', () => {
    expect(sugerirCodigoDeTipoDeficiencia('A'.repeat(80))).toHaveLength(50);
  });

  it('devolve string vazia quando não sobra nada aproveitável', () => {
    expect(sugerirCodigoDeTipoDeficiencia('  ---  ')).toBe('');
  });

  /**
   * A sugestão preenche o campo sozinha. Se propusesse algo que o validador
   * recusa, o operador veria o código já em erro sem ter chegado a tocá-lo —
   * pior do que campo vazio, que ele preenche sabendo o que está fazendo.
   */
  it.each([
    ['nome que começa por dígito', '21 de abril'],
    ['nome de uma letra só', 'A'],
    ['nome que vira um caractere', 'Á!'],
  ])('não sugere código inválido: %s', (_caso, nome) => {
    expect(sugerirCodigoDeTipoDeficiencia(nome)).toBe('');
  });

  it('sugere quando o nome começa por letra e sobra o bastante', () => {
    expect(sugerirCodigoDeTipoDeficiencia('TEA - Transtorno do Espectro Autista')).toBe(
      'TEA_TRANSTORNO_DO_ESPECTRO_AUTISTA',
    );
  });
});
