import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, type FatoCandidatoView, type ModeloFormularioView } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModeloFormularioEdicaoPage } from './modelo-formulario-edicao.page';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000a1';
const MODELO = `${BASE}/api/configuracao/admin/modelos-formulario/${ID}`;
const PROBLEMA = { status: 422, statusText: 'Recusa', headers: { 'content-type': 'application/problem+json' } };

const fato = (codigo: string): FatoCandidatoView => ({
  id: codigo,
  codigo,
  nome: codigo,
  descricao: null,
  dominio: 'BOOLEANO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  binding: `CAMPO_FORMULARIO:${codigo}`,
  valoresDominioDeclarados: null,
  fonteValores: null,
  ativo: true,
  escopo: 'CANDIDATO',
});

/**
 * Um modelo de inscrição como a API o devolve: com a seção dos dados básicos, e com o que esta
 * tela ainda não edita — termo, grupo, restrição e impedimento.
 */
const modelo: ModeloFormularioView = {
  id: ID,
  codigo: 'INSCRICAO_MEDICINA',
  nome: 'Inscrição Medicina',
  descricao: null,
  finalidade: 'INSCRICAO',
  tipoProcessoCodigo: null,
  ativo: true,
  conteudo: {
    titulo: 'Inscrição',
    etapas: [
      { codigo: 'DADOS_BASICOS', ordem: 0, tipo: 'SECAO', bloco: null, titulo: 'Dados do candidato', descricao: null, aviso: null },
      { codigo: 'SECAO_1', ordem: 1, tipo: 'SECAO', bloco: null, titulo: 'Escolaridade', descricao: null, aviso: null },
      { codigo: 'REVISAO_E_ACEITE', ordem: 2, tipo: 'BLOCO', bloco: 'REVISAO_E_ACEITE', titulo: 'Revisão e aceite', descricao: null, aviso: null },
    ],
    itens: [
      { fatoCodigo: 'NOME', ordem: 0, rotulo: 'Nome', tipoRenderizacao: 'TEXTO', obrigatoriedade: 'SEMPRE', precondicao: null, etapaCodigo: 'DADOS_BASICOS', pedirConfirmacao: false },
      {
        fatoCodigo: 'ESCOLA_PUBLICA',
        ordem: 1,
        rotulo: 'Estudou em escola pública?',
        tipoRenderizacao: 'BOOLEANO',
        obrigatoriedade: 'SEMPRE',
        precondicao: null,
        etapaCodigo: 'SECAO_1',
        pedirConfirmacao: false,
        restricoes: [{ tipo: 'SUBCONJUNTO', entradas: [{ quando: null, valores: ['true'] }] }],
        impedimento: { quando: [[{ fato: 'ESCOLA_PUBLICA', operador: 'IGUAL', valor: false }]], mensagem: 'Só para egressos.' },
      },
    ],
    termos: [
      { codigo: 'LGPD', ordem: 0, termoId: 'T1', versaoId: 'V1', exibicao: null, obrigatoriedade: 'SEMPRE', predicadoObrigatoriedade: null },
    ],
    pressupostos: [],
    grupos: [
      {
        codigo: 'FAMILIA',
        ordem: 2,
        rotulo: 'Composição familiar',
        etapaCodigo: 'SECAO_1',
        minimo: 1,
        maximo: null,
        exibicao: null,
        obrigatoriedade: 'SEMPRE',
        predicadoObrigatoriedade: null,
        subitens: [],
        incluiCandidato: true,
      },
    ],
  },
};

describe('ModeloFormularioEdicaoPage', () => {
  let fixture: ComponentFixture<ModeloFormularioEdicaoPage>;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ModeloFormularioEdicaoPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: ID }) } } },
      ],
    });
    fixture = TestBed.createComponent(ModeloFormularioEdicaoPage);
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  async function propagar(): Promise<HTMLElement> {
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  async function carregar(): Promise<HTMLElement> {
    controller.expectOne(MODELO).flush(modelo);
    controller.expectOne(`${BASE}/api/configuracao/fatos-candidato`).flush([fato('NOME'), fato('ESCOLA_PUBLICA')]);
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`).flush([]);
    return propagar();
  }

  function salvar(tela: HTMLElement): void {
    const botao = [...tela.querySelectorAll('button[type="submit"]')].find((b) => b.textContent?.includes('Salvar modelo'));
    (botao as HTMLButtonElement).click();
  }

  it('salva o conteúdo sem os dados básicos, que a API repõe, e com termos, grupos, restrições e impedimento intactos', async () => {
    const tela = await carregar();

    salvar(tela);
    const req = controller.expectOne((r) => r.method === 'PUT' && r.url === MODELO);
    const conteudo = req.request.body.conteudo;

    expect(conteudo.etapas.map((e: { codigo: string }) => e.codigo)).toEqual(['SECAO_1', 'REVISAO_E_ACEITE']);
    expect(conteudo.itens.map((i: { fatoCodigo: string }) => i.fatoCodigo)).toEqual(['ESCOLA_PUBLICA']);
    expect(conteudo.itens[0].restricoes).toEqual(modelo.conteudo.itens?.[1].restricoes);
    expect(conteudo.itens[0].impedimento).toEqual(modelo.conteudo.itens?.[1].impedimento);
    expect(conteudo.termos).toEqual(modelo.conteudo.termos);
    expect(conteudo.grupos).toEqual(modelo.conteudo.grupos);
    expect(req.request.headers.get('Idempotency-Key')).not.toBeNull();
    req.flush(null, { status: 204, statusText: 'No Content' });
    controller.expectOne(MODELO).flush(modelo);
  });

  it('leva a recusa com índice ao campo enviado, e a do grafo, sem índice, ao resumo', async () => {
    const tela = await carregar();

    salvar(tela);
    controller.expectOne((r) => r.method === 'PUT').flush(
      JSON.stringify({
        status: 422,
        title: 'Requisição inválida',
        code: 'uniplus.configuracao.modelo_formulario.conteudo_invalido',
        errors: [
          { field: 'conteudo.itens[0].rotulo', code: 'x', message: 'O rótulo passou do tamanho.' },
          { field: 'conteudo', code: 'y', message: 'O item cita fato que vem depois dele.' },
        ],
      }),
      PROBLEMA,
    );
    const depois = await propagar();

    const item = depois.querySelector('[aria-labelledby="cfg-modelo-item-ESCOLA_PUBLICA-titulo"]');
    expect(item?.textContent).toContain('O rótulo passou do tamanho.');
    const resumo = depois.querySelector('.cfg-modelo-resumo');
    expect(resumo?.textContent).toContain('O item cita fato que vem depois dele.');
    expect(resumo?.textContent).not.toContain('O rótulo passou do tamanho.');
  });
});
