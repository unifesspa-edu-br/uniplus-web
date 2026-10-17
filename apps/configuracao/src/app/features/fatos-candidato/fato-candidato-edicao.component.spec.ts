import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, type FatoCandidatoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FatoCandidatoEdicaoComponent } from './fato-candidato-edicao.component';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000f1';

const corRaca = (sistema: boolean): FatoCandidatoDto => ({
  id: ID,
  codigo: 'COR_RACA',
  nome: 'Cor ou raça',
  descricao: null,
  dominio: 'CATEGORICO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  fonteValores: 'GLOBAL',
  formato: null,
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO_INSCRICAO:COR_RACA',
  escopo: 'CANDIDATO',
  classificacaoProtecao: 'SENSIVEL',
  finalidadeTratamento: 'Reserva de vagas.',
  hipoteseLegal: 'CUMPRIMENTO_OBRIGACAO_LEGAL',
  sistema,
  ativo: true,
  valores: [{ codigo: 'PRETA', descricao: 'Preta', ordem: 0, ativo: true }],
  regrasPadrao: [],
});

describe('FatoCandidatoEdicaoComponent', () => {
  let fixture: ComponentFixture<FatoCandidatoEdicaoComponent>;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FatoCandidatoEdicaoComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(FatoCandidatoEdicaoComponent);
    fixture.componentRef.setInput('id', ID);
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  async function carregar(fato: FatoCandidatoDto, catalogo: readonly unknown[] = []): Promise<HTMLElement> {
    controller.expectOne(`${BASE}/api/configuracao/admin/fatos-candidato/${ID}`).flush(fato);
    controller.expectOne(`${BASE}/api/configuracao/fatos-candidato`).flush(catalogo);
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('CA-03/CA-04: o fato de sistema mostra os valores só para leitura, e o do administrador deixa mantê-los', async () => {
    const sistema = await carregar(corRaca(true));
    expect(sistema.textContent).toContain('Fato de sistema');
    expect(sistema.textContent, 'os valores do fato de sistema aparecem').toContain('PRETA');
    expect(sistema.textContent).not.toContain('Acrescentar valor');
    expect(sistema.textContent).not.toContain('Desativar');
  });

  it('só para consultar, nada se edita: sem salvar, sem acrescentar nem desativar, e a definição chega aberta', async () => {
    fixture.componentRef.setInput('somenteLeitura', true);
    const tela = await carregar(corRaca(false));

    expect(tela.textContent).not.toContain('Salvar nome e descrição');
    expect(tela.textContent).not.toContain('Acrescentar valor');
    expect(tela.textContent).not.toContain('Desativar');
    expect((tela.querySelector('input[formcontrolname="nome"]') as HTMLInputElement).readOnly).toBe(true);
    const definicao = tela.querySelector('ui-recolhivel button') as HTMLButtonElement;
    expect(definicao.getAttribute('aria-expanded')).toBe('true');
  });

  it('só para consultar, o Enter que envia o formulário não grava nada', async () => {
    fixture.componentRef.setInput('somenteLeitura', true);
    const tela = await carregar(corRaca(false));

    (tela.querySelector('#cfg-fato-descritivo') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    controller.expectNone(`${BASE}/api/configuracao/admin/fatos-candidato/${ID}`);
  });

  it('CA-03: no fato do administrador, os valores se acrescentam e desativam', async () => {
    const administrador = await carregar(corRaca(false));
    expect(administrador.textContent).not.toContain('Fato de sistema');
    expect(administrador.textContent).toContain('Acrescentar valor');
    expect(administrador.textContent).toContain('Desativar');
  });

  it('o valor desativado se reativa com chave de idempotência, e o foco volta ao botão da linha', async () => {
    const comDesativado = { ...corRaca(false), valores: [{ codigo: 'PRETA', descricao: 'Preta', ordem: 0, ativo: false }] };
    const tela = await carregar(comDesativado);
    const reativar = tela.querySelector<HTMLButtonElement>('#cfg-fato-valor-PRETA-acao');
    expect(reativar?.textContent).toContain('Reativar');

    reativar?.click();
    const post = controller.expectOne(`${BASE}/api/configuracao/admin/fatos-candidato/${ID}/valores/PRETA/ativacao`);
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.has('Idempotency-Key')).toBe(true);
    post.flush(null, { status: 204, statusText: 'No Content' });
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    controller.expectOne(`${BASE}/api/configuracao/admin/fatos-candidato/${ID}`).flush(corRaca(false));
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();

    expect(document.activeElement?.id).toBe('cfg-fato-valor-PRETA-acao');
    expect(document.activeElement?.textContent).toContain('Desativar');
  });

  it('CA-05: a regra incompleta é barrada na tela, e a completa vai à API com o predicado aninhado', async () => {
    const perfil: FatoCandidatoDto = {
      ...corRaca(false),
      codigo: 'PERFIL',
      origem: 'DERIVADO',
      cardinalidade: 'MULTIVALORADO',
      binding: 'REGRA_DERIVACAO:PERFIL',
      valores: [{ codigo: 'A', descricao: null, ordem: 0, ativo: true }],
    };
    const quilombola = {
      id: 'q', codigo: 'QUILOMBOLA', nome: 'Quilombola', descricao: null, dominio: 'BOOLEANO', origem: 'DECLARADO',
      cardinalidade: 'ESCALAR', valoresDominio: null, pontoResolucao: 'INSCRICAO', binding: 'CAMPO_INSCRICAO:QUILOMBOLA',
      valoresDominioDeclarados: null, fonteValores: null, ativo: true, escopo: 'CANDIDATO',
    };
    await carregar(perfil, [quilombola]);
    const componente = fixture.componentInstance as unknown as {
      acrescentarRegra(): void;
      trocarContribuicao(indice: number, valor: string): void;
      trocarCondicoes(indice: number, condicoes: readonly unknown[]): void;
      salvarRegras(): void;
      errosDasRegras(): Record<number, string>;
    };

    componente.acrescentarRegra();
    componente.salvarRegras();
    expect(componente.errosDasRegras()[0]).toBe('Declare ao menos uma condição.');

    componente.trocarContribuicao(0, 'A');
    componente.trocarCondicoes(0, [{ clausula: 1, fato: 'QUILOMBOLA', operador: 'IGUAL', valor: 'true' }]);
    componente.salvarRegras();

    const put = controller.expectOne(`${BASE}/api/configuracao/admin/fatos-candidato/${ID}/regras-padrao`);
    expect(put.request.body).toEqual({ regras: [{ contribui: 'A', quando: [[{ fato: 'QUILOMBOLA', operador: 'IGUAL', valor: true }]] }] });
    put.flush(null, { status: 204, statusText: 'No Content' });
    controller.match(`${BASE}/api/configuracao/admin/fatos-candidato/${ID}`).forEach((req) => req.flush(perfil));
  });

  it('o valor acrescentado leva a orientação sem os espaços das pontas, e a orientação em branco vai nula', async () => {
    await carregar(corRaca(false));
    const componente = fixture.componentInstance as unknown as {
      novoValor: { setValue(v: { codigo: string; descricao: string; orientacao: string }): void };
      acrescentarValor(): void;
    };
    const acrescentar = async (orientacao: string): Promise<unknown> => {
      componente.novoValor.setValue({ codigo: 'PARDA', descricao: 'Parda', orientacao });
      componente.acrescentarValor();
      const post = controller.expectOne(`${BASE}/api/configuracao/admin/fatos-candidato/${ID}/valores`);
      const corpo = post.request.body;
      post.flush(null, { status: 204, statusText: 'No Content' });
      await Promise.resolve();
      TestBed.inject(ApplicationRef).tick();
      controller.expectOne(`${BASE}/api/configuracao/admin/fatos-candidato/${ID}`).flush(corRaca(false));
      await Promise.resolve();
      TestBed.inject(ApplicationRef).tick();
      return corpo;
    };

    expect(await acrescentar('  Passa pela heteroidentificação.  ')).toMatchObject({
      codigo: 'PARDA',
      orientacao: 'Passa pela heteroidentificação.',
    });
    expect(await acrescentar('   ')).toMatchObject({ orientacao: null });
  });

  it('acrescentar o valor que falta não apaga a regra que está sendo montada', async () => {
    const perfil: FatoCandidatoDto = { ...corRaca(false), codigo: 'PERFIL', origem: 'DERIVADO', binding: 'REGRA_DERIVACAO:PERFIL', valores: [] };
    await carregar(perfil);
    const componente = fixture.componentInstance as unknown as {
      acrescentarRegra(): void;
      regras(): readonly unknown[];
      novoValor: { setValue(v: { codigo: string; descricao: string; orientacao: string }): void };
      acrescentarValor(): void;
    };
    componente.acrescentarRegra();
    componente.novoValor.setValue({ codigo: 'B', descricao: '', orientacao: '' });

    componente.acrescentarValor();
    controller.expectOne(`${BASE}/api/configuracao/admin/fatos-candidato/${ID}/valores`).flush(null, { status: 204, statusText: 'No Content' });
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    controller
      .expectOne(`${BASE}/api/configuracao/admin/fatos-candidato/${ID}`)
      .flush({ ...perfil, valores: [{ codigo: 'B', descricao: null, ordem: 0, ativo: true }] });
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();

    expect(componente.regras()).toHaveLength(1);
  });

  it('a regra salva que cita fato desativado não trava o salvamento das demais', async () => {
    const perfil: FatoCandidatoDto = {
      ...corRaca(false),
      codigo: 'PERFIL',
      origem: 'DERIVADO',
      dominio: 'BOOLEANO',
      fonteValores: null,
      binding: 'REGRA_DERIVACAO:PERFIL',
      valores: [],
      regrasPadrao: [{ contribui: null, quando: [[{ fato: 'QUILOMBOLA', operador: 'IGUAL', valor: true }]] }],
    };
    const quilombolaDesativado = {
      id: 'q', codigo: 'QUILOMBOLA', nome: 'Quilombola', descricao: null, dominio: 'BOOLEANO', origem: 'DECLARADO',
      cardinalidade: 'ESCALAR', valoresDominio: null, pontoResolucao: 'INSCRICAO', binding: 'CAMPO_INSCRICAO:QUILOMBOLA',
      valoresDominioDeclarados: null, fonteValores: null, ativo: false, escopo: 'CANDIDATO',
    };
    await carregar(perfil, [quilombolaDesativado]);
    const componente = fixture.componentInstance as unknown as { salvarRegras(): void; errosDasRegras(): Record<number, string> };

    componente.salvarRegras();

    expect(componente.errosDasRegras()).toEqual({});
    controller.expectOne(`${BASE}/api/configuracao/admin/fatos-candidato/${ID}/regras-padrao`).flush(null, { status: 204, statusText: 'No Content' });
    controller.match(`${BASE}/api/configuracao/admin/fatos-candidato/${ID}`).forEach((req) => req.flush(perfil));
  });

  it('sem o catálogo de fatos, as regras avisam e oferecem tentar de novo', async () => {
    const perfil: FatoCandidatoDto = { ...corRaca(false), codigo: 'PERFIL', origem: 'DERIVADO', binding: 'REGRA_DERIVACAO:PERFIL' };
    controller.expectOne(`${BASE}/api/configuracao/admin/fatos-candidato/${ID}`).flush(perfil);
    controller
      .expectOne(`${BASE}/api/configuracao/fatos-candidato`)
      .flush(JSON.stringify({ status: 503, title: 'Indisponível', code: 'uniplus.indisponivel' }), {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'content-type': 'application/problem+json' },
      });
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Catálogo de fatos não carregado');
  });

  it('o erro da condição não passa para outra depois que a regra é editada', async () => {
    const perfil: FatoCandidatoDto = { ...corRaca(false), codigo: 'PERFIL', origem: 'DERIVADO', dominio: 'BOOLEANO', fonteValores: null, binding: 'REGRA_DERIVACAO:PERFIL', valores: [] };
    const quilombola = {
      id: 'q', codigo: 'QUILOMBOLA', nome: 'Quilombola', descricao: null, dominio: 'BOOLEANO', origem: 'DECLARADO',
      cardinalidade: 'ESCALAR', valoresDominio: null, pontoResolucao: 'INSCRICAO', binding: 'CAMPO_INSCRICAO:QUILOMBOLA',
      valoresDominioDeclarados: null, fonteValores: null, ativo: true, escopo: 'CANDIDATO',
    };
    await carregar(perfil, [quilombola]);
    const componente = fixture.componentInstance as unknown as {
      acrescentarRegra(): void;
      trocarCondicoes(indice: number, condicoes: readonly unknown[]): void;
      salvarRegras(): void;
      errosDasCondicoes(): Record<number, Record<number, string> | undefined>;
    };
    const semValor = { clausula: 1, fato: 'QUILOMBOLA', operador: 'IGUAL', valor: '' };
    const completa = { clausula: 1, fato: 'QUILOMBOLA', operador: 'IGUAL', valor: 'true' };
    componente.acrescentarRegra();
    componente.trocarCondicoes(0, [semValor, completa]);
    componente.salvarRegras();
    expect(componente.errosDasCondicoes()[0]).toEqual({ 0: expect.any(String) });

    componente.trocarCondicoes(0, [completa]);

    expect(componente.errosDasCondicoes()[0], 'a condição que sobrou não herda o erro da removida').toBeUndefined();
  });
  describe('correção e ordem dos valores', () => {
    const URL_FATO = `${BASE}/api/configuracao/admin/fatos-candidato/${ID}`;
    const tresValores = (): FatoCandidatoDto => ({
      ...corRaca(false),
      valores: [
        { codigo: 'PRETA', descricao: 'Preta', ordem: 0, ativo: true },
        { codigo: 'PARDA', descricao: 'Parda', ordem: 1, ativo: false },
        { codigo: 'BRANCA', descricao: 'Branca', ordem: 2, ativo: true },
      ],
    });
    const botao = (tela: HTMLElement, codigo: string, acao: string): HTMLButtonElement =>
      tela.querySelector<HTMLButtonElement>(`#cfg-fato-valor-${codigo}-${acao}`) as HTMLButtonElement;
    async function assentar(): Promise<void> {
      await Promise.resolve();
      TestBed.inject(ApplicationRef).tick();
      fixture.detectChanges();
    }

    it('editar envia a descrição e a orientação sem as pontas e põe a recusa de campo no campo da linha', async () => {
      const tela = await carregar(tresValores());
      botao(tela, 'PRETA', 'editar').click();
      fixture.detectChanges();
      const campos = fixture.componentInstance as unknown as { edicaoDoValor: { setValue(v: { descricao: string; orientacao: string }): void } };
      campos.edicaoDoValor.setValue({ descricao: '  Preta (autodeclarada)  ', orientacao: '   ' });
      (tela.querySelector('#cfg-fato-valor-PRETA-form') as HTMLFormElement).dispatchEvent(new Event('submit'));

      const put = controller.expectOne(`${URL_FATO}/valores/PRETA`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.headers.has('Idempotency-Key')).toBe(true);
      expect(put.request.body).toEqual({ descricao: 'Preta (autodeclarada)', orientacao: null });
      put.flush(
        JSON.stringify({ status: 422, title: 'Inválido', code: 'uniplus.validacao', errors: [{ field: 'Descricao', code: 'uniplus.validacao.tamanho', message: 'Descrição acima do limite.' }] }),
        { status: 422, statusText: 'Unprocessable Entity', headers: { 'content-type': 'application/problem+json' } },
      );
      await assentar();

      expect(tela.querySelector('#cfg-fato-valor-PRETA-descricao-erro')?.textContent).toContain('Descrição acima do limite.');
    });

    it('subir e descer enviam a lista completa, desativados inclusive, com o valor trocado de lugar', async () => {
      const tela = await carregar(tresValores());
      expect(botao(tela, 'PRETA', 'subir').disabled, 'o primeiro não sobe').toBe(true);
      expect(botao(tela, 'BRANCA', 'descer').disabled, 'o último não desce').toBe(true);

      botao(tela, 'BRANCA', 'subir').click();
      const put = controller.expectOne(`${URL_FATO}/ordem-dos-valores`);
      expect(put.request.method).toBe('PUT');
      expect(put.request.headers.has('Idempotency-Key')).toBe(true);
      expect(put.request.body).toEqual({ codigos: ['PRETA', 'BRANCA', 'PARDA'] });
      put.flush(null, { status: 204, statusText: 'No Content' });
      await assentar();
      controller.expectOne(URL_FATO).flush(tresValores());
    });

    it('o botão de mover cita o valor no nome acessível, e o foco volta a ele depois da recarga', async () => {
      const tela = await carregar(tresValores());
      expect(botao(tela, 'BRANCA', 'subir').textContent).toContain('Subir o valor BRANCA');

      botao(tela, 'PARDA', 'descer').click();
      controller.expectOne(`${URL_FATO}/ordem-dos-valores`).flush(null, { status: 204, statusText: 'No Content' });
      await assentar();
      const depois = tresValores();
      controller.expectOne(URL_FATO).flush({ ...depois, valores: [depois.valores[0], depois.valores[2], depois.valores[1]] });
      await assentar();

      // Foi para a última posição: o "Descer" ficou desabilitado e o foco vai ao "Subir".
      expect(document.activeElement?.id).toBe('cfg-fato-valor-PARDA-subir');
    });

    it('o fato de sistema mostra os valores sem Editar, Subir nem Descer', async () => {
      const tela = await carregar({ ...tresValores(), sistema: true });
      expect(tela.textContent).toContain('BRANCA');
      for (const texto of ['Editar', 'Subir', 'Descer']) expect(tela.textContent).not.toContain(texto);
    });

    it('o agregado herda os valores: aparecem sem Editar, Subir nem Descer', async () => {
      const tela = await carregar({ ...tresValores(), binding: 'AGREGACAO_GRUPO:GRUPO.CAMPO' });
      expect(tela.textContent).toContain('BRANCA');
      for (const texto of ['Editar', 'Subir', 'Descer']) expect(tela.textContent).not.toContain(texto);
    });

    const problema = (status: number, code: string): [string, { status: number; statusText: string; headers: Record<string, string> }] => [
      JSON.stringify({ status, title: 'Problema', code }),
      { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
    ];

    it('o conflito de concorrência recarrega o fato, fecha a edição e avisa que a versão atual foi carregada', async () => {
      const tela = await carregar(tresValores());
      botao(tela, 'PRETA', 'editar').click();
      fixture.detectChanges();
      (tela.querySelector('#cfg-fato-valor-PRETA-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      controller.expectOne(`${URL_FATO}/valores/PRETA`).flush(...problema(409, 'uniplus.concorrencia.conflito'));
      await assentar();

      expect(tela.textContent).toContain('A versão atual foi carregada');
      expect(tela.querySelector('#cfg-fato-valor-PRETA-form'), 'a edição em linha fechou').toBeNull();
      controller.expectOne(URL_FATO).flush(tresValores());
      await assentar();
      expect(document.activeElement, 'o foco volta ao Editar da linha').toBe(botao(tela, 'PRETA', 'editar'));
    });

    it('o 409 de idempotência em processamento mostra a mensagem da API, sem recarregar nem falar em outra pessoa', async () => {
      const tela = await carregar(tresValores());
      botao(tela, 'BRANCA', 'subir').click();
      controller.expectOne(`${URL_FATO}/ordem-dos-valores`).flush(...problema(409, 'uniplus.idempotency.processing_conflict'));
      await assentar();

      expect(tela.textContent).not.toContain('Outra pessoa alterou');
      controller.expectNone(URL_FATO);
    });

    it('um 409 que não é de concorrência mostra a mensagem da API e mantém a edição aberta, sem recarregar', async () => {
      const tela = await carregar(tresValores());
      botao(tela, 'PRETA', 'editar').click();
      fixture.detectChanges();
      (tela.querySelector('#cfg-fato-valor-PRETA-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      controller.expectOne(`${URL_FATO}/valores/PRETA`).flush(...problema(409, 'uniplus.configuracao.fato_candidato.codigo_ja_existe'));
      await assentar();

      expect(tela.textContent).not.toContain('Outra pessoa alterou');
      expect(tela.querySelector('#cfg-fato-valor-PRETA-form'), 'a edição segue aberta').not.toBeNull();
      controller.expectNone(URL_FATO);
    });

    it('Desativar e Reativar ficam desabilitados e não enviam enquanto um valor está em edição', async () => {
      const tela = await carregar(tresValores());
      botao(tela, 'PRETA', 'editar').click();
      fixture.detectChanges();
      const acoes = Array.from(tela.querySelectorAll<HTMLButtonElement>('[id$="-acao"]'));
      expect(acoes.length).toBeGreaterThan(0);
      for (const acao of acoes) {
        expect(acao.disabled).toBe(true);
        acao.click();
      }
      const alvo = fixture.componentInstance as unknown as { desativarValor(c: string): void; reativarValor(c: string): void };
      alvo.desativarValor('BRANCA');
      alvo.reativarValor('BRANCA');
      controller.expectNone((req) => req.url.includes('/valores/BRANCA'));
    });

    it('a recarga que termina em erro de transporte libera o bloqueio', async () => {
      const tela = await carregar(tresValores());
      botao(tela, 'BRANCA', 'subir').click();
      controller.expectOne(`${URL_FATO}/ordem-dos-valores`).flush(null, { status: 204, statusText: 'No Content' });
      await assentar();
      const estado = fixture.componentInstance as unknown as { bloqueado(): boolean };
      expect(estado.bloqueado()).toBe(true);

      controller.expectOne(URL_FATO).error(new ProgressEvent('error'));
      await assentar();
      expect(estado.bloqueado()).toBe(false);
    });

    it('cancelar a edição limpa a mensagem de erro da tentativa anterior', async () => {
      const tela = await carregar(tresValores());
      botao(tela, 'PRETA', 'editar').click();
      fixture.detectChanges();
      (tela.querySelector('#cfg-fato-valor-PRETA-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      controller.expectOne(`${URL_FATO}/valores/PRETA`).flush(...problema(409, 'uniplus.configuracao.fato_candidato.codigo_ja_existe'));
      await assentar();
      const estado = fixture.componentInstance as unknown as { erro(): string | null };
      expect(estado.erro()).not.toBeNull();

      (tela.querySelector('#cfg-fato-valor-PRETA-form') as HTMLFormElement).closest('tr')?.querySelector<HTMLButtonElement>('button[type="button"]')?.click();
      fixture.detectChanges();
      expect(estado.erro()).toBeNull();
    });

    it('subir e descer ficam bloqueados até o fato recarregado chegar, e a ordem seguinte parte da lista nova', async () => {
      const tela = await carregar(tresValores());
      botao(tela, 'BRANCA', 'subir').click();
      controller.expectOne(`${URL_FATO}/ordem-dos-valores`).flush(null, { status: 204, statusText: 'No Content' });
      await assentar();
      const recarga = controller.expectOne(URL_FATO);

      expect(botao(tela, 'BRANCA', 'subir').disabled, 'a lista na tela ainda é a antiga').toBe(true);
      botao(tela, 'BRANCA', 'subir').click();
      controller.expectNone(`${URL_FATO}/ordem-dos-valores`);

      const v = tresValores().valores;
      recarga.flush({ ...tresValores(), valores: [v[0], v[2], v[1]] });
      await assentar();
      expect(botao(tela, 'BRANCA', 'subir').disabled).toBe(false);
    });

    it('acrescentar fica bloqueado até o fato recarregado chegar, porque a ordem sai do total de valores', async () => {
      const tela = await carregar(tresValores());
      botao(tela, 'BRANCA', 'subir').click();
      controller.expectOne(`${URL_FATO}/ordem-dos-valores`).flush(null, { status: 204, statusText: 'No Content' });
      await assentar();
      const recarga = controller.expectOne(URL_FATO);

      const acrescentar = [...tela.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Acrescentar valor') as HTMLButtonElement;
      expect(acrescentar.disabled).toBe(true);
      recarga.flush(tresValores());
      await assentar();
      expect(acrescentar.disabled).toBe(false);
    });

    it('abrir a edição leva o foco ao campo da descrição', async () => {
      const tela = await carregar(tresValores());
      botao(tela, 'PRETA', 'editar').click();
      await assentar();
      expect(document.activeElement).toBe(tela.querySelector('#cfg-fato-valor-PRETA-descricao'));
    });

    it('a descrição só com espaços no fato declarado é barrada como vazia, sem enviar', async () => {
      const tela = await carregar(tresValores());
      botao(tela, 'PRETA', 'editar').click();
      fixture.detectChanges();
      const campos = fixture.componentInstance as unknown as { edicaoDoValor: { setValue(v: { descricao: string; orientacao: string }): void } };
      campos.edicaoDoValor.setValue({ descricao: '   ', orientacao: '' });
      (tela.querySelector('#cfg-fato-valor-PRETA-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      fixture.detectChanges();

      controller.expectNone(`${URL_FATO}/valores/PRETA`);
      expect(tela.querySelector('#cfg-fato-valor-PRETA-descricao-erro')?.textContent).toContain('Campo obrigatório.');
    });

    it('a chave da correção muda quando o alvo muda depois de um 5xx, e se repete na mesma tentativa', async () => {
      const tela = await carregar(tresValores());
      const campos = fixture.componentInstance as unknown as { edicaoDoValor: { setValue(v: { descricao: string; orientacao: string }): void } };
      const tentar = async (codigo: string, descricao: string): Promise<string | null> => {
        botao(tela, codigo, 'editar').click();
        fixture.detectChanges();
        campos.edicaoDoValor.setValue({ descricao, orientacao: '' });
        (tela.querySelector(`#cfg-fato-valor-${codigo}-form`) as HTMLFormElement).dispatchEvent(new Event('submit'));
        const req = controller.expectOne(`${URL_FATO}/valores/${codigo}`);
        const chave = req.request.headers.get('Idempotency-Key');
        req.flush(...problema(503, 'uniplus.indisponivel'));
        await assentar();
        return chave;
      };
      const primeira = await tentar('PRETA', 'Preta 1');
      // A edição segue aberta após a falha: repete a mesma tentativa.
      (tela.querySelector('#cfg-fato-valor-PRETA-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      const repetida = controller.expectOne(`${URL_FATO}/valores/PRETA`);
      expect(repetida.request.headers.get('Idempotency-Key')).toBe(primeira);
      repetida.flush(...problema(503, 'uniplus.indisponivel'));
      await assentar();

      campos.edicaoDoValor.setValue({ descricao: 'Preta 2', orientacao: '' });
      (tela.querySelector('#cfg-fato-valor-PRETA-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      const outroCorpo = controller.expectOne(`${URL_FATO}/valores/PRETA`);
      expect(outroCorpo.request.headers.get('Idempotency-Key'), 'outro corpo, outra chave').not.toBe(primeira);
      const chaveDaPreta = outroCorpo.request.headers.get('Idempotency-Key');
      outroCorpo.flush(...problema(503, 'uniplus.indisponivel'));
      await assentar();

      // Mesmo corpo em outro alvo: a chave não pode ser a da PRETA.
      (tela.querySelector('#cfg-fato-valor-PRETA-form') as HTMLFormElement).closest('tr')?.querySelector<HTMLButtonElement>('button[type="button"]')?.click();
      fixture.detectChanges();
      botao(tela, 'BRANCA', 'editar').click();
      fixture.detectChanges();
      campos.edicaoDoValor.setValue({ descricao: 'Preta 2', orientacao: '' });
      (tela.querySelector('#cfg-fato-valor-BRANCA-form') as HTMLFormElement).dispatchEvent(new Event('submit'));
      const outroAlvo = controller.expectOne(`${URL_FATO}/valores/BRANCA`);
      expect(outroAlvo.request.headers.get('Idempotency-Key'), 'outro alvo, outra chave').not.toBe(chaveDaPreta);
      outroAlvo.flush(...problema(503, 'uniplus.indisponivel'));
      await assentar();
    });

    it('com um valor em edição os outros Editar e o mover ficam bloqueados; trocar de fato fecha a edição', async () => {
      const tela = await carregar(tresValores());
      botao(tela, 'PRETA', 'editar').click();
      fixture.detectChanges();

      expect(botao(tela, 'BRANCA', 'editar').disabled).toBe(true);
      expect(botao(tela, 'BRANCA', 'subir').disabled).toBe(true);

      fixture.componentRef.setInput('id', 'outro-fato');
      fixture.detectChanges();
      controller.expectOne(`${BASE}/api/configuracao/admin/fatos-candidato/outro-fato`).flush({ ...tresValores(), id: 'outro-fato' });
      await assentar();
      expect(tela.querySelector('#cfg-fato-valor-PRETA-form'), 'a edição do fato anterior não passa para o novo').toBeNull();
    });
  });
});
