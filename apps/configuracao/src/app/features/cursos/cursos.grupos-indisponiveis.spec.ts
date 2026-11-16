import { HttpTestingController } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProblemI18nService } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogoGruposAreaEnem } from '../../shared/grupos-area-enem';
import {
  CURSOS_URL,
  cursoSeed,
  GRUPOS,
  GRUPOS_URL,
  montarCursosPage,
} from './cursos.listagem.testing';
import { CursosPage } from './cursos.page';
import { EdicaoDosCursos } from './edicao-dos-cursos';

describe('CursosPage — lista de grupos de área do ENEM que não chega', () => {
  let fixture!: ComponentFixture<CursosPage>;
  let edicao!: EdicaoDosCursos;
  let controller!: HttpTestingController;
  let appRef!: ApplicationRef;

  const indisponivel = (): void =>
    controller
      .expectOne(GRUPOS_URL)
      .flush(
        { title: 'Indisponível', status: 503 },
        { status: 503, statusText: 'Service Unavailable' },
      );

  beforeEach(async () => {
    const pagina = montarCursosPage();
    ({ fixture, edicao, controller, appRef } = pagina);
    controller.expectOne((r) => r.url === CURSOS_URL).flush([cursoSeed]);
    await pagina.propagate();
  });

  afterEach(() => controller.verify());

  it('a edição mostra o grupo do curso pelo rótulo da API, e o alerta oferece tentar de novo', async () => {
    edicao.abrirEdicao(cursoSeed);
    // A lista de grupos, pedida ao abrir a página, não chega.
    indisponivel();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).toContain('Grupos de área do ENEM não carregados');
    // Sem a lista, o select ainda mostra o grupo do curso: salvar não reenvia um grupo
    // que o operador nunca viu selecionado.
    const select = raiz.querySelector<HTMLSelectElement>('select[formcontrolname="grupoAreaEnem"]');
    if (!select) throw new Error('select do grupo ausente');
    expect(Array.from(select.options).map((opcao) => opcao.value)).toEqual(['', 'TECNOLOGICA']);
    expect(select.options[select.selectedIndex]?.textContent?.trim()).toBe('Tecnológica');

    const tentar = Array.from(raiz.querySelectorAll('button')).find(
      (botao) => botao.textContent?.trim() === 'Tentar novamente',
    );
    tentar?.click();
    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
    fixture.detectChanges();
    await new Promise((resolver) => setTimeout(resolver));
    appRef.tick();

    expect(raiz.textContent).not.toContain('Grupos de área do ENEM não carregados');
    // Com a lista, o grupo do curso aparece uma vez só, entre os da API.
    expect(Array.from(select.options).map((opcao) => opcao.value)).toEqual([
      '',
      ...GRUPOS.map((g) => g.codigo),
    ]);
    expect(select.options[select.selectedIndex]?.value).toBe('TECNOLOGICA');
  });

  it('tentar de novo mantém o foco no formulário: o alerta fica até a tentativa terminar e o foco vai ao select', async () => {
    edicao.abrirEdicao(cursoSeed);
    indisponivel();
    fixture.detectChanges();
    // O drawer leva o foco ao botão de fechar logo depois de abrir: deixa isso acontecer antes.
    await Promise.resolve();

    const raiz = fixture.nativeElement as HTMLElement;
    const botao = raiz.querySelector<HTMLButtonElement>('#cfg-curso-grupos-tentar');
    if (!botao) throw new Error('botão de tentar de novo ausente');
    botao.focus();
    botao.click();
    fixture.detectChanges();

    // Enquanto a nova tentativa corre, o botão continua na tela, com o foco e desabilitado.
    expect(raiz.querySelector('#cfg-curso-grupos-tentar')).toBe(botao);
    expect(document.activeElement).toBe(botao);
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    // Acionar de novo durante a tentativa não a reinicia: segue um pedido só, o primeiro.
    botao.click();
    const pedidos = controller.match(GRUPOS_URL);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]?.cancelled).toBe(false);

    pedidos[0]?.flush([...GRUPOS]);
    fixture.detectChanges();
    await Promise.resolve();
    appRef.tick();

    // A lista chegou: o alerta sai, e o foco vai ao select que ela alimenta, sem cair no body.
    expect(raiz.querySelector('#cfg-curso-grupos-tentar')).toBeNull();
    expect(document.activeElement?.id).toBe('cfg-curso-grupo-area-enem');
  });

  it('recusa sem título mostra só o texto padrão, sem ponto solto no início', () => {
    edicao.abrirEdicao(cursoSeed);
    controller.expectOne(GRUPOS_URL).flush(
      {
        type: 'about:blank',
        title: '',
        status: 503,
        code: 'uniplus.teste.sem_titulo',
        traceId: 't',
      },
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('#cfg-curso-grupos-falha')
        ?.textContent?.trim(),
    ).toBe('Sem a lista de grupos não é possível classificar o curso.');
  });

  it('curso cru com o grupo sem rótulo, com a lista em falha: a opção do grupo mostra o código', () => {
    edicao.abrirEdicao({ ...cursoSeed, grupoAreaEnem: { codigo: 'TECNOLOGICA', rotulo: '' } });
    indisponivel();
    fixture.detectChanges();

    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#cfg-curso-grupo-area-enem',
    );
    const opcao = Array.from(select?.options ?? []).find((o) => o.value === 'TECNOLOGICA');
    expect(opcao?.textContent?.trim()).toBe('TECNOLOGICA');
  });

  it('motivo só com espaços cai no texto padrão', () => {
    edicao.abrirEdicao(cursoSeed);
    controller.expectOne(GRUPOS_URL).flush(
      {
        type: 'about:blank',
        title: '   ',
        status: 503,
        code: 'uniplus.teste.sem_titulo',
        traceId: 't',
      },
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('#cfg-curso-grupos-falha')
        ?.textContent?.trim(),
    ).toBe('Sem a lista de grupos não é possível classificar o curso.');
  });

  it('lista vazia é falha de carga: alerta com tentar de novo, como na recusa', () => {
    edicao.abrirEdicao(cursoSeed);
    controller.expectOne(GRUPOS_URL).flush([]);
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).toContain('Grupos de área do ENEM não carregados');
    expect(raiz.querySelector('#cfg-curso-grupos-tentar')).not.toBeNull();
  });

  it('o select do grupo é descrito pelo alerta de falha enquanto a lista não chega', async () => {
    edicao.abrirEdicao(cursoSeed);
    indisponivel();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const select = raiz.querySelector<HTMLSelectElement>('#cfg-curso-grupo-area-enem');
    const descricao = select?.getAttribute('aria-describedby') ?? '';
    expect(raiz.querySelector(`[id="${descricao}"]`)?.textContent?.trim()).toContain(
      'Sem a lista de grupos não é possível classificar o curso.',
    );

    raiz.querySelector<HTMLButtonElement>('#cfg-curso-grupos-tentar')?.click();
    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
    fixture.detectChanges();
    await new Promise((resolver) => setTimeout(resolver));
    appRef.tick();
    expect(select?.hasAttribute('aria-describedby')).toBe(false);
  });

  it('recarga em segundo plano que dá certo não mexe no foco', async () => {
    edicao.abrirEdicao(cursoSeed);
    indisponivel();
    fixture.detectChanges();
    await Promise.resolve();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('#cfg-curso-grupos-tentar')).not.toBeNull();
    // O operador não acionou nada: o foco está fora de qualquer campo.
    (document.activeElement as HTMLElement | null)?.blur();

    // Outra tela pede o vocabulário de novo, e ele chega.
    TestBed.inject(CatalogoGruposAreaEnem).garantirCarregado();
    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);
    fixture.detectChanges();
    await Promise.resolve();
    appRef.tick();

    expect(raiz.querySelector('#cfg-curso-grupos-tentar')).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('com a lista em falha, dá para trocar para "Não classificado" e voltar ao grupo original do curso', () => {
    edicao.abrirEdicao(cursoSeed);
    indisponivel();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const select = raiz.querySelector<HTMLSelectElement>('#cfg-curso-grupo-area-enem');
    if (!select) throw new Error('select do grupo ausente');
    const valores = (): string[] => Array.from(select.options, (opcao) => opcao.value);
    expect(valores()).toEqual(['', 'TECNOLOGICA']);

    select.value = '';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    // A opção do grupo original continua, para o operador poder voltar a ela.
    expect(valores()).toEqual(['', 'TECNOLOGICA']);

    select.value = 'TECNOLOGICA';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(edicao.form.controls.grupoAreaEnem.value).toBe('TECNOLOGICA');
    expect(select.options[select.selectedIndex]?.textContent?.trim()).toBe('Tecnológica');
  });

  it('recarga que falha com a lista anterior em memória não mostra alerta, e o select segue com ela', () => {
    // A lista chegou antes (outra tela ou outra abertura do formulário).
    const catalogo = TestBed.inject(CatalogoGruposAreaEnem);
    catalogo.garantirCarregado();
    controller.expectOne(GRUPOS_URL).flush([...GRUPOS]);

    edicao.abrirEdicao(cursoSeed);
    catalogo.recarregar();
    indisponivel();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).not.toContain('Grupos de área do ENEM não carregados');
    const select = raiz.querySelector<HTMLSelectElement>('#cfg-curso-grupo-area-enem');
    expect(Array.from(select?.options ?? [], (opcao) => opcao.value)).toEqual([
      '',
      ...GRUPOS.map((g) => g.codigo),
    ]);
  });

  it('falha de servidor dos grupos mostra o motivo no alerta e avisa com o traceId', () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    edicao.abrirEdicao(cursoSeed);
    controller.expectOne(GRUPOS_URL).flush(
      JSON.stringify({
        title: 'Serviço indisponível',
        status: 503,
        code: 'uniplus.internal.unexpected',
        traceId: 'trace-grupos',
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    fixture.detectChanges();

    expect(erroSpy).toHaveBeenCalledTimes(1);
    expect(erroSpy.mock.calls[0]?.[0]).toMatchObject({ status: 503, traceId: 'trace-grupos' });
    const mensagem = (fixture.nativeElement as HTMLElement)
      .querySelector('#cfg-curso-grupos-falha')
      ?.textContent?.trim();
    expect(mensagem).toContain('Sem a lista de grupos não é possível classificar o curso.');
    expect(mensagem).not.toBe('Sem a lista de grupos não é possível classificar o curso.');
  });

  it('grupos recusados por permissão mostram o motivo sem aviso de servidor', () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    edicao.abrirEdicao(cursoSeed);
    const semPermissao = {
      title: 'Acesso negado',
      status: 403,
      code: 'uniplus.auth.forbidden',
      traceId: 't',
    };
    controller.expectOne(GRUPOS_URL).flush(JSON.stringify(semPermissao), {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'content-type': 'application/problem+json' },
    });
    fixture.detectChanges();

    const titulo = TestBed.inject(ProblemI18nService).resolve(
      semPermissao as Parameters<ProblemI18nService['resolve']>[0],
    ).title;
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('#cfg-curso-grupos-falha')?.textContent,
    ).toContain(titulo);
    expect(erroSpy).not.toHaveBeenCalled();
  });
});
