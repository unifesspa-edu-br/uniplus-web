import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, type FatoCandidatoView } from '@uniplus/shared-data/configuracao';
import type { ConteudoDoFormulario } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PreVisualizacaoDoModeloComponent } from './pre-visualizacao-do-modelo.component';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000a1';

const fato = (codigo: string, dominio = 'BOOLEANO'): FatoCandidatoView => ({
  id: codigo,
  codigo,
  nome: codigo,
  descricao: null,
  dominio,
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

/** A habilitação cita a forma de conclusão, que vem da inscrição, e o próprio campo de certificado. */
const conteudo: ConteudoDoFormulario = {
  titulo: null,
  etapas: [
    {
      codigo: 'S1',
      ordem: 0,
      tipo: 'SECAO',
      bloco: null,
      titulo: 'Escolaridade',
      descricao: null,
      aviso: null,
    },
  ],
  itens: [
    {
      fatoCodigo: 'CERTIFICADO',
      ordem: 0,
      rotulo: 'Tem o certificado?',
      tipoRenderizacao: 'BOOLEANO',
      obrigatoriedade: 'SEMPRE',
      precondicao: [[{ fato: 'CONCLUIU', operador: 'IGUAL', valor: true }]],
      etapaCodigo: 'S1',
      pedirConfirmacao: false,
    },
    {
      fatoCodigo: 'ANO',
      ordem: 1,
      rotulo: 'Ano de conclusão',
      tipoRenderizacao: 'NUMERO',
      obrigatoriedade: 'SEMPRE',
      precondicao: [[{ fato: 'CERTIFICADO', operador: 'IGUAL', valor: true }]],
      etapaCodigo: 'S1',
      pedirConfirmacao: false,
    },
  ],
  termos: [],
  pressupostos: ['CONCLUIU'],
  grupos: [],
};

describe('PreVisualizacaoDoModeloComponent', () => {
  let fixture: ComponentFixture<PreVisualizacaoDoModeloComponent>;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PreVisualizacaoDoModeloComponent],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(PreVisualizacaoDoModeloComponent);
    fixture.componentRef.setInput('modeloId', ID);
    fixture.componentRef.setInput('conteudo', conteudo);
    fixture.componentRef.setInput('catalogo', [
      fato('CERTIFICADO'),
      fato('ANO', 'NUMERICO'),
      fato('CONCLUIU'),
    ]);
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const tela = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const botao = (): HTMLButtonElement =>
    [...tela().querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Pré-visualizar'),
    ) as HTMLButtonElement;

  function escolher(id: string, valor: string): void {
    const select = tela().querySelector(`#${id}`) as HTMLSelectElement;
    select.value = valor;
    select.dispatchEvent(new Event('change'));
  }

  it('simula a resposta do campo e o pressuposto em separado, e anuncia o resumo da avaliação', async () => {
    escolher('cfg-simulacao-CONCLUIU', 'true');
    escolher('cfg-simulacao-CERTIFICADO', 'false');
    botao().click();

    const req = controller.expectOne(
      `${BASE}/api/configuracao/admin/modelos-formulario/${ID}/pre-visualizacao`,
    );
    expect(req.request.body).toEqual({
      respostas: { CERTIFICADO: false },
      etapasConcluidas: [],
      pressupostos: { CONCLUIU: true },
    });
    req.flush({
      itens: [
        {
          fatoCodigo: 'CERTIFICADO',
          etapaCodigo: 'S1',
          visivel: 'VERDADEIRO',
          obrigatorio: 'VERDADEIRO',
          restricoesVioladas: [],
          impedido: 'FALSO',
          mensagemDoImpedimento: null,
        },
        {
          fatoCodigo: 'ANO',
          etapaCodigo: 'S1',
          visivel: 'FALSO',
          obrigatorio: 'FALSO',
          restricoesVioladas: [],
          impedido: 'FALSO',
          mensagemDoImpedimento: null,
        },
      ],
      termos: [],
    });
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    fixture.detectChanges();

    expect(tela().querySelector('[role="status"]')?.textContent?.trim()).toBe(
      'Pré-visualização pronta: 1 de 2 campos exibidos, 1 obrigatórios.',
    );
  });

  it('esvazia o resumo ao pré-visualizar de novo, para o leitor de tela anunciar o resultado seguinte', async () => {
    const resposta = { itens: [], termos: [] };
    botao().click();
    controller.expectOne((r) => r.url.endsWith('/pre-visualizacao')).flush(resposta);
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    fixture.detectChanges();
    expect(tela().querySelector('[role="status"]')?.textContent?.trim()).not.toBe('');

    botao().click();
    fixture.detectChanges();

    expect(tela().querySelector('[role="status"]')?.textContent?.trim()).toBe('');
    controller.expectOne((r) => r.url.endsWith('/pre-visualizacao')).flush(resposta);
  });

  it('oferece simular o campo com restrição de valor, que nenhuma regra cita', () => {
    fixture.componentRef.setInput('conteudo', {
      ...conteudo,
      itens: [
        ...(conteudo.itens ?? []),
        {
          fatoCodigo: 'IDADE',
          ordem: 2,
          rotulo: 'Idade',
          tipoRenderizacao: 'NUMERO',
          obrigatoriedade: 'SEMPRE',
          precondicao: null,
          etapaCodigo: 'S1',
          pedirConfirmacao: false,
          restricoes: [{ tipo: 'FAIXA', minimo: 16, maximo: null }],
        },
      ],
    });
    fixture.componentRef.setInput('catalogo', [
      fato('CERTIFICADO'),
      fato('ANO', 'NUMERICO'),
      fato('CONCLUIU'),
      fato('IDADE', 'NUMERICO'),
    ]);
    fixture.detectChanges();

    expect(tela().querySelector('#cfg-simulacao-IDADE')).not.toBeNull();
  });

  it('envia como lista a resposta de um fato numérico com vários valores', () => {
    fixture.componentRef.setInput('conteudo', {
      ...conteudo,
      itens: [
        {
          fatoCodigo: 'NOTAS',
          ordem: 0,
          rotulo: 'Notas',
          tipoRenderizacao: 'NUMERO',
          obrigatoriedade: 'SEMPRE',
          precondicao: null,
          etapaCodigo: 'S1',
          pedirConfirmacao: false,
        },
      ],
      pressupostos: [],
    });
    fixture.componentRef.setInput('catalogo', [
      { ...fato('NOTAS', 'NUMERICO'), cardinalidade: 'MULTIVALORADO' },
    ]);
    fixture.detectChanges();

    const campo = tela().querySelector('#cfg-simulacao-NOTAS') as HTMLInputElement;
    campo.value = '7; 8';
    campo.dispatchEvent(new Event('input'));
    botao().click();

    const req = controller.expectOne((r) => r.url.endsWith('/pre-visualizacao'));
    expect(req.request.body.respostas).toEqual({ NOTAS: [7, 8] });
    req.flush({ itens: [], termos: [] });
  });

  it('recusa o valor não reconhecido num fato de vários valores, em vez de simular outro no lugar', () => {
    fixture.componentRef.setInput('conteudo', {
      ...conteudo,
      itens: [
        {
          fatoCodigo: 'NOTAS',
          ordem: 0,
          rotulo: 'Notas',
          tipoRenderizacao: 'NUMERO',
          obrigatoriedade: 'SEMPRE',
          precondicao: null,
          etapaCodigo: 'S1',
          pedirConfirmacao: false,
        },
      ],
      pressupostos: [],
    });
    fixture.componentRef.setInput('catalogo', [
      { ...fato('NOTAS', 'NUMERICO'), cardinalidade: 'MULTIVALORADO' },
    ]);
    fixture.detectChanges();

    const campo = tela().querySelector('#cfg-simulacao-NOTAS') as HTMLInputElement;
    campo.value = '7; 7,5';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(botao().disabled).toBe(true);
  });

  it('recusa decimal no fato numérico de valor único, que só admite inteiro', () => {
    const campo = tela().querySelector('#cfg-simulacao-ANO') as HTMLInputElement;
    campo.value = '7,5';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(botao().disabled).toBe(true);
  });

  it('não oferece simular campo de grupo, cuja resposta a pré-visualização da API não recebe', () => {
    fixture.componentRef.setInput('conteudo', {
      ...conteudo,
      grupos: [
        {
          codigo: 'DEPENDENTES',
          ordem: 2,
          rotulo: 'Dependentes',
          etapaCodigo: 'S1',
          minimo: 0,
          maximo: null,
          exibicao: null,
          obrigatoriedade: 'SEMPRE',
          predicadoObrigatoriedade: null,
          incluiCandidato: false,
          subitens: [
            {
              fatoCodigo: 'IDADE_DEPENDENTE',
              ordem: 0,
              rotulo: 'Idade',
              tipoRenderizacao: 'NUMERO',
              obrigatoriedade: 'SEMPRE',
              precondicao: null,
              pedirConfirmacao: false,
            },
          ],
        },
      ],
    });
    fixture.componentRef.setInput('catalogo', [
      fato('CERTIFICADO'),
      fato('ANO', 'NUMERICO'),
      fato('CONCLUIU'),
      fato('IDADE_DEPENDENTE', 'NUMERICO'),
    ]);
    fixture.detectChanges();

    expect(tela().querySelector('#cfg-simulacao-IDADE_DEPENDENTE')).toBeNull();
  });

  it('descarta o resultado quando uma resposta simulada muda, para não mostrar avaliação de outros valores', async () => {
    botao().click();
    controller
      .expectOne((r) => r.url.endsWith('/pre-visualizacao'))
      .flush({ itens: [], termos: [] });
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    fixture.detectChanges();
    expect(tela().querySelector('[role="status"]')?.textContent?.trim()).not.toBe('');

    escolher('cfg-simulacao-CONCLUIU', 'true');
    fixture.detectChanges();

    expect(tela().querySelector('[role="status"]')?.textContent?.trim()).toBe('');
  });

  it('esconde o resultado quando o rascunho passa a divergir do modelo avaliado', async () => {
    botao().click();
    controller
      .expectOne((r) => r.url.endsWith('/pre-visualizacao'))
      .flush({ itens: [], termos: [] });
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    fixture.detectChanges();

    fixture.componentRef.setInput('desatualizado', true);
    fixture.detectChanges();

    expect(tela().querySelector('[role="status"]')?.textContent?.trim()).toBe('');
  });

  it('com alteração não salva, não pré-visualiza e diz por quê', () => {
    fixture.componentRef.setInput('desatualizado', true);
    fixture.detectChanges();

    expect(botao().disabled).toBe(true);
    expect(tela().textContent).toContain('Salve para pré-visualizar as alterações.');
  });
});
