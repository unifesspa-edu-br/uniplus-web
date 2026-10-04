import { TestBed } from '@angular/core/testing';
import { NEVER } from 'rxjs';
import { describe, expect, it } from 'vitest';
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
