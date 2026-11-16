import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import { CursoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BASE,
  cursoSeed,
  montarCursosPage,
  OFERTAS_URL,
  ofertaSeed,
} from './cursos.listagem.testing';
import { CursosPage } from './cursos.page';
import { CursosStore } from './cursos.store';
import { EdicaoDosCursos } from './edicao-dos-cursos';
import { OfertasDoCursoStore } from './ofertas-do-curso.store';

describe('CursosPage', () => {
  let fixture!: ComponentFixture<CursosPage>;
  let store!: CursosStore;
  let edicao!: EdicaoDosCursos;
  let ofertasDoCurso!: OfertasDoCursoStore;
  let controller!: HttpTestingController;
  let propagate!: () => Promise<void>;
  let responderGrupos!: () => void;
  let flushLista!: (itens: readonly CursoDto[]) => Promise<void>;
  let encerrar!: () => void;

  beforeEach(() => {
    ({
      fixture,
      store,
      edicao,
      ofertasDoCurso,
      controller,
      propagate,
      responderGrupos,
      flushLista,
      encerrar,
    } = montarCursosPage());
  });

  afterEach(() => {
    encerrar();
  });

  it('renderiza a lista de cursos', async () => {
    await flushLista([cursoSeed]);
    expect(store.cursos()).toHaveLength(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Engenharia Civil');
    expect(fixture.nativeElement.textContent).toContain('ENG-CIV');
  });

  it('CA-02: cria curso com código único, nome, grau e nível válidos', async () => {
    await flushLista([]);

    edicao.abrirCadastro();
    responderGrupos();
    edicao.form.setValue({
      codigo: 'ADM',
      nome: 'Administração',
      grau: 'Bacharelado',
      nivelEnsino: 'Graduação',
      grupoAreaEnem: '',
    });
    edicao.salvar();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/cursos`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    expect(post.request.body).toMatchObject({
      codigo: 'ADM',
      nome: 'Administração',
      grau: 'Bacharelado',
      nivelEnsino: 'Graduação',
      grupoAreaEnem: null,
    });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();

    await flushLista([cursoSeed]);
    expect(edicao.aberto()).toBe(false);
  });

  it('CA-02: cria curso sem grupo de área do ENEM (campo opcional)', async () => {
    await flushLista([]);
    edicao.abrirCadastro();
    responderGrupos();
    edicao.form.setValue({
      codigo: 'HIST',
      nome: 'História',
      grau: 'Licenciatura',
      nivelEnsino: 'Graduação',
      grupoAreaEnem: '',
    });
    edicao.salvar();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/cursos`);
    expect(post.request.body.grupoAreaEnem).toBeNull();
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('bloqueia salvar com campos obrigatórios vazios', async () => {
    await flushLista([]);
    edicao.abrirCadastro();
    responderGrupos();
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector(
      'button[form="cfg-curso-form"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);

    edicao.salvar();

    controller.expectNone(`${BASE}/api/configuracao/admin/cursos`);
  });

  it('CA-03: código duplicado (409) é mapeado ao campo Código sem fechar o drawer', async () => {
    await flushLista([]);
    edicao.abrirCadastro();
    responderGrupos();
    edicao.form.setValue({
      codigo: 'ENG-CIV',
      nome: 'Engenharia Civil (duplicado)',
      grau: 'Bacharelado',
      nivelEnsino: 'Graduação',
      grupoAreaEnem: '',
    });
    edicao.salvar();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/cursos`);
    post.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.curso.codigo_ja_existe',
        title: 'Já existe um curso ativo com este código',
        status: 409,
        code: 'uniplus.configuracao.curso.codigo_ja_existe',
        traceId: 'test-trace',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(edicao.aberto()).toBe(true);
    expect(edicao.form.controls.codigo.errors?.['backend']).toBeTruthy();
  });

  it('CA-08/CA2: remoção bloqueada (409) fecha o confirm e abre o drawer de Ofertas com o preview do bloqueio', async () => {
    await flushLista([cursoSeed]);
    edicao.pedirRemocao(cursoSeed);
    edicao.removerConfirmado();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/cursos/${cursoSeed.id}`);
    req.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.curso.remocao_bloqueada_por_oferta_curso',
        title: 'Não é possível remover um curso referenciado por uma oferta de curso ativa',
        status: 409,
        code: 'uniplus.configuracao.curso.remocao_bloqueada_por_oferta_curso',
        traceId: 'test-trace',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    // O confirm não reabre; abre o drawer de Ofertas com a mensagem que a API devolveu.
    expect(edicao.confirmando()).toBe(false);
    expect(ofertasDoCurso.aberto()).toBe(true);
    expect(ofertasDoCurso.bloqueio()).toBe(
      'Não é possível remover um curso referenciado por uma oferta de curso ativa',
    );

    // E consulta as ofertas do curso via ?cursoId para o preview do bloqueio.
    const ofertas = controller.expectOne((r) => r.url === OFERTAS_URL);
    expect(ofertas.request.params.get('cursoId')).toBe(cursoSeed.id);
    ofertas.flush([ofertaSeed]);
    await propagate();
    expect(ofertasDoCurso.itens()).toHaveLength(1);
  });

  it('remove um curso sem oferta viva após confirmação', async () => {
    await flushLista([cursoSeed]);
    edicao.pedirRemocao(cursoSeed);
    edicao.removerConfirmado();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/cursos/${cursoSeed.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
    expect(edicao.confirmando()).toBe(false);
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await flushLista([cursoSeed]);
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('table > caption');
    // Sem `sr-only` a legenda vira texto visível acima da tabela e quebra o layout.
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Cursos cadastrados, com código, grau, nível e grupo ENEM',
    );
  });
});
