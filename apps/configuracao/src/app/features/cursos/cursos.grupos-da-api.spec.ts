import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import { CursoDto, type GrupoAreaEnemDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BASE, cursoSeed, GRUPOS, GRUPOS_URL, montarCursosPage } from './cursos.listagem.testing';
import { CursosPage } from './cursos.page';
import { EdicaoDosCursos } from './edicao-dos-cursos';

describe('CursosPage — grupo de área do ENEM vindo da API', () => {
  let fixture!: ComponentFixture<CursosPage>;
  let edicao!: EdicaoDosCursos;
  let controller!: HttpTestingController;
  let propagate!: () => Promise<void>;
  let responderGrupos!: () => void;
  let flushLista!: (itens: readonly CursoDto[]) => Promise<void>;
  let encerrar!: () => void;

  beforeEach(() => {
    ({ fixture, edicao, controller, propagate, responderGrupos, flushLista, encerrar } =
      montarCursosPage());
  });

  afterEach(() => {
    encerrar();
  });

  const opcoesDoSelect = (): { value: string; texto: string }[] =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLOptionElement>(
        'select[formcontrolname="grupoAreaEnem"] option',
      ),
      (opcao) => ({ value: opcao.value, texto: opcao.textContent?.trim() ?? '' }),
    );

  const selectDoGrupo = (): HTMLSelectElement =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      'select[formcontrolname="grupoAreaEnem"]',
    ) as HTMLSelectElement;

  it('CA-01: o select oferece os grupos que a API devolve, na ordem dela, com o código como valor', async () => {
    await flushLista([]);
    // Outra lista e outra ordem: o select acompanha a API, não uma lista do cliente.
    controller.expectOne(GRUPOS_URL).flush([
      { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' },
      { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
    ]);
    // A lista já chegou: abrir o formulário não a pede de novo.
    edicao.abrirCadastro();
    fixture.detectChanges();

    expect(opcoesDoSelect()).toEqual([
      { value: '', texto: 'Não classificado' },
      { value: 'SAUDE_E_BIOLOGICAS', texto: 'Saúde e Biológicas' },
      { value: 'TECNOLOGICA', texto: 'Tecnológica' },
    ]);
  });

  it('CA-01: grupo da API sem rótulo aparece no select pelo código', async () => {
    await flushLista([]);
    controller.expectOne(GRUPOS_URL).flush([
      { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
      { codigo: 'OUTRO', rotulo: ' ' },
    ]);
    edicao.abrirCadastro();
    fixture.detectChanges();

    expect(opcoesDoSelect()).toContainEqual({ value: 'OUTRO', texto: 'OUTRO' });
  });

  it('CA-02: com o vocabulário carregado, a tabela usa o rótulo dele, como o select', async () => {
    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
    await flushLista([
      { ...cursoSeed, grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: 'Rótulo antigo' } },
      // Sem rótulo, do jeito que a API pode devolver: o código, ou o traço sem código.
      {
        ...cursoSeed,
        id: '01960000-0000-7000-0000-0000000000c6',
        grupoAreaEnem: { codigo: 'Z', rotulo: null } as unknown as GrupoAreaEnemDto,
      },
      {
        ...cursoSeed,
        id: '01960000-0000-7000-0000-0000000000c7',
        grupoAreaEnem: { codigo: undefined, rotulo: undefined } as unknown as GrupoAreaEnemDto,
      },
    ]);
    fixture.detectChanges();

    const celulas = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('td[data-label="Grupo ENEM"]'),
      (td) => td.textContent?.trim(),
    );
    expect(celulas).toEqual(['Tecnológica', 'Z', '—']);
  });

  it('CA-02: com o rótulo oficial em branco, tabela e select mostram o mesmo texto', async () => {
    controller.expectOne(GRUPOS_URL).flush([
      { codigo: 'TECNOLOGICA', rotulo: ' ' },
      // Sem código não há o que gravar: o item não vira opção.
      { codigo: ' ', rotulo: 'Sem código' },
    ]);
    await flushLista([
      { ...cursoSeed, grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: 'Rótulo do registro' } },
    ]);
    edicao.abrirCadastro();
    fixture.detectChanges();

    const naTabela = (fixture.nativeElement as HTMLElement)
      .querySelector('td[data-label="Grupo ENEM"]')
      ?.textContent?.trim();
    expect(naTabela).toBe('TECNOLOGICA');
    expect(opcoesDoSelect()).toEqual([
      { value: '', texto: 'Não classificado' },
      { value: 'TECNOLOGICA', texto: 'TECNOLOGICA' },
    ]);
  });

  it('CA-02: a tabela mostra o rótulo do grupo, não o código', async () => {
    await flushLista([
      cursoSeed,
      { ...cursoSeed, id: '01960000-0000-7000-0000-0000000000c2', grupoAreaEnem: null },
      // Rótulo vazio mostra o código, como o formulário, e não o traço de "não classificado".
      {
        ...cursoSeed,
        id: '01960000-0000-7000-0000-0000000000c3',
        grupoAreaEnem: { codigo: 'X', rotulo: '' },
      },
      // Rótulo só com espaços também conta como vazio; sem rótulo nem código, fica o traço.
      {
        ...cursoSeed,
        id: '01960000-0000-7000-0000-0000000000c4',
        grupoAreaEnem: { codigo: 'Y', rotulo: '  ' },
      },
      {
        ...cursoSeed,
        id: '01960000-0000-7000-0000-0000000000c5',
        grupoAreaEnem: { codigo: '', rotulo: '' },
      },
    ]);
    fixture.detectChanges();

    const celulas = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('td[data-label="Grupo ENEM"]'),
      (td) => td.textContent?.trim(),
    );
    expect(celulas).toEqual(['Tecnológica', '—', 'X', 'Y', '—']);
  });

  it('CA-02: o grupo escolhido no select é enviado pelo código', async () => {
    await flushLista([]);
    edicao.abrirCadastro();
    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
    edicao.form.patchValue({
      codigo: 'DIR',
      nome: 'Direito',
      grau: 'Bacharelado',
      nivelEnsino: 'Graduação',
    });
    fixture.detectChanges();

    const select = selectDoGrupo();
    const humanistica = Array.from(select.options).find(
      (opcao) => opcao.textContent?.trim() === 'Humanística I',
    );
    select.value = humanistica?.value ?? '';
    select.dispatchEvent(new Event('change'));
    edicao.salvar();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/cursos`);
    expect(post.request.body.grupoAreaEnem).toBe('HUMANISTICA_I');
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('CA-02: editar um curso seleciona o grupo dele pelo código e o reenvia pelo código', async () => {
    await flushLista([cursoSeed]);
    edicao.abrirEdicao(cursoSeed);
    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
    fixture.detectChanges();

    expect(edicao.form.controls.grupoAreaEnem.value).toBe('TECNOLOGICA');
    const select = selectDoGrupo();
    expect(select.options[select.selectedIndex]?.textContent?.trim()).toBe('Tecnológica');

    edicao.salvar();
    const put = controller.expectOne(`${BASE}/api/configuracao/admin/cursos/${cursoSeed.id}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.grupoAreaEnem).toBe('TECNOLOGICA');
    put.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([cursoSeed]);
  });

  it('CA-03: grupo recusado pela API aparece no campo do grupo, com a mensagem dela', async () => {
    await flushLista([]);
    edicao.abrirCadastro();
    responderGrupos();
    edicao.form.setValue({
      codigo: 'DIR',
      nome: 'Direito',
      grau: 'Bacharelado',
      nivelEnsino: 'Graduação',
      grupoAreaEnem: 'TECNOLOGICA',
    });
    edicao.salvar();

    controller.expectOne(`${BASE}/api/configuracao/admin/cursos`).flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.curso.grupo_area_enem_invalido',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        traceId: 'test-trace',
        errors: [
          {
            field: 'grupoAreaEnem',
            code: 'uniplus.configuracao.curso.grupo_area_enem_invalido',
            message: 'Grupo de área do ENEM fora dos grupos da Resolução nº 805/2024/Consepe.',
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
    fixture.detectChanges();

    const campo = selectDoGrupo().closest('label') as HTMLElement;
    expect(campo.querySelector('.field__error')?.textContent?.trim()).toBe(
      'Grupo de área do ENEM fora dos grupos da Resolução nº 805/2024/Consepe.',
    );
    expect(selectDoGrupo().getAttribute('aria-invalid')).toBe('true');
    // O erro é anunciado e descreve o select (WCAG 3.3.1).
    const erro = campo.querySelector('.field__error');
    expect(erro?.getAttribute('role')).toBe('alert');
    expect(selectDoGrupo().getAttribute('aria-describedby')?.split(' ')).toContain(erro?.id);
    expect(edicao.erro()).toBeNull();
  });
});
