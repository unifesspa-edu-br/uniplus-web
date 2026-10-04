import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { NEVER, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUSCA_DE_MUNICIPIOS } from '../editor-de-condicoes/valor-de-municipio';
import type { ConteudoDoFormulario, FatoDoFormulario } from '../editor-de-formulario/formulario-editavel';
import { PreVisualizacaoDeFormulariosComponent, type SimulacaoDeFormularios } from './pre-visualizacao-de-formularios';

const PARFOR: FatoDoFormulario = {
  codigo: 'PARFOR',
  nome: 'Vínculo com o PARFOR',
  dominio: 'BOOLEANO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  valoresDominio: null,
  binding: 'CAMPO_FORMULARIO:PARFOR',
  fonteValores: null,
  escopo: 'CANDIDATO',
  ativo: true,
} as unknown as FatoDoFormulario;

const vazio: ConteudoDoFormulario = { titulo: null, etapas: [], itens: [], termos: [], pressupostos: [], grupos: [] };

describe('PreVisualizacaoDeFormulariosComponent', () => {
  it('o campo que um formulário coleta vai como resposta, mesmo que outro, listado antes, o pressuponha', () => {
    const habilitacao: ConteudoDoFormulario = { ...vazio, pressupostos: ['PARFOR'] };
    const inscricao: ConteudoDoFormulario = {
      ...vazio,
      etapas: [{ codigo: 'S1', ordem: 0, tipo: 'SECAO', bloco: null, titulo: 'Vínculos', descricao: null, aviso: null }],
      itens: [{ fatoCodigo: 'PARFOR', ordem: 0, rotulo: 'Cursa pelo PARFOR?', tipoRenderizacao: 'BOOLEANO', obrigatoriedade: 'SEMPRE', etapaCodigo: 'S1', pedirConfirmacao: false }],
    };
    let enviada: SimulacaoDeFormularios | null = null;

    const fixture = TestBed.createComponent(PreVisualizacaoDeFormulariosComponent);
    fixture.componentRef.setInput('formularios', [
      { finalidade: 'HABILITACAO', nome: 'habilitação', conteudo: habilitacao },
      { finalidade: 'INSCRICAO', nome: 'inscrição', conteudo: inscricao },
    ]);
    fixture.componentRef.setInput('catalogo', [PARFOR]);
    fixture.componentRef.setInput('avaliar', (simulacao: SimulacaoDeFormularios) => {
      enviada = simulacao;
      return NEVER;
    });
    fixture.componentRef.setInput('idBase', 'previa');
    fixture.componentRef.setInput('origem', 'O processo gravado.');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const parfor = host.querySelector('#previa-simulacao-PARFOR') as HTMLSelectElement;
    parfor.value = 'true';
    parfor.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (Array.from(host.querySelectorAll('button')).find((botao) => botao.textContent?.trim() === 'Pré-visualizar') as HTMLButtonElement).click();

    expect(enviada).toMatchObject({ respostas: { PARFOR: true }, pressupostos: {} });
  });
});

describe('PreVisualizacaoDeFormulariosComponent com campo de município', () => {
  afterEach(() => vi.useRealTimers());

  it('responde o município pelo código IBGE, escolhido pelo nome na busca', async () => {
    vi.useFakeTimers();
    const municipio = { ...PARFOR, codigo: 'MUNICIPIO_RESIDENCIA', nome: 'Município de residência', dominio: 'CATEGORICO', fonteValores: 'GEO_MUNICIPIO' } as FatoDoFormulario;
    const inscricao: ConteudoDoFormulario = {
      ...vazio,
      etapas: [{ codigo: 'S1', ordem: 0, tipo: 'SECAO', bloco: null, titulo: 'Endereço', descricao: null, aviso: null }],
      itens: [{ fatoCodigo: 'MUNICIPIO_RESIDENCIA', ordem: 0, rotulo: 'Município', tipoRenderizacao: 'MUNICIPIO', obrigatoriedade: 'SEMPRE', etapaCodigo: 'S1', pedirConfirmacao: false }],
    };
    let enviada: SimulacaoDeFormularios | null = null;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: BUSCA_DE_MUNICIPIOS,
          useValue: () => of({ ok: true as const, data: [{ codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' }], status: 200, headers: new HttpHeaders() }),
        },
      ],
    });

    const fixture = TestBed.createComponent(PreVisualizacaoDeFormulariosComponent);
    fixture.componentRef.setInput('formularios', [{ finalidade: 'INSCRICAO', nome: 'inscrição', conteudo: inscricao }]);
    fixture.componentRef.setInput('catalogo', [municipio]);
    fixture.componentRef.setInput('avaliar', (simulacao: SimulacaoDeFormularios) => {
      enviada = simulacao;
      return NEVER;
    });
    fixture.componentRef.setInput('idBase', 'previa');
    fixture.componentRef.setInput('origem', 'O processo gravado.');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    const campo = host.querySelector('input[role="combobox"]') as HTMLInputElement;
    campo.value = 'Mar';
    campo.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(300);
    fixture.detectChanges();
    [...host.querySelectorAll<HTMLElement>('[role="option"]')].find((opcao) => opcao.textContent?.includes('Marabá'))?.dispatchEvent(new MouseEvent('mousedown'));
    fixture.detectChanges();
    (Array.from(host.querySelectorAll('button')).find((botao) => botao.textContent?.trim() === 'Pré-visualizar') as HTMLButtonElement).click();

    expect(enviada).toMatchObject({ respostas: { MUNICIPIO_RESIDENCIA: '1504208' } });

    // A resposta volta a "sem resposta", como nos outros campos.
    const limpar = (): HTMLButtonElement | undefined =>
      Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((botao) => botao.textContent?.includes('sem resposta'));
    limpar()?.click();
    fixture.detectChanges();
    expect(limpar(), 'sem resposta, não há o que limpar').toBeUndefined();
    expect(host.querySelector('[role="option"][aria-selected="true"]')).toBeNull();
  });
});
