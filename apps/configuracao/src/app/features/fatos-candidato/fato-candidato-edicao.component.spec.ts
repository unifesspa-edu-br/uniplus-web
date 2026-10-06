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
});
