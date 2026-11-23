import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TipoDeDecisaoDoDocumento as Tipo } from '@uniplus/shared-data/selecao';
import { describe, expect, it, vi } from 'vitest';

import { ProcedimentoDoTipoComponent } from './procedimento-do-tipo.component';
import { escolher } from './procedimentos-do-recurso.edicao.testing';
import { tiposNaTela } from './procedimentos-na-tela';
import { procedimentoDoDocumento, regraDoCatalogo } from './procedimentos.testing';
import { rotuloDaApi } from '../../../shared/decisoes-da-fase-ou-etapa/tipos-de-decisao-da-api.testing';

const CODIGO = 'PROCEDIMENTO-RECURSO-RECORRECAO';
const CHAVE = `${CODIGO}|v1`;
const DECLARADO = procedimentoDoDocumento({ regra: { codigo: CODIGO, versao: 'v1' } });
const ITEM = { itemDeAvaliacaoChave: 'argumentacao' };

async function montar(entradas: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(ProcedimentoDoTipoComponent);
  document.body.appendChild(fixture.nativeElement);
  const padrao = {
    tipo: tiposNaTela([], [Tipo.NOTA_DA_ETAPA], rotuloDaApi)[0],
    idBase: 'procedimento',
    regrasDoCatalogo: [regraDoCatalogo(CODIGO, 'Referência institucional')],
    alvosOferecidos: [],
    modo: 'edicao',
    semProcedimento: false,
  };
  for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
    fixture.componentRef.setInput(nome, valor);
  }
  fixture.detectChanges();
  TestBed.inject(ApplicationRef).tick();
  const elementoDaTela = fixture.nativeElement as HTMLElement;
  return { fixture, elementoDaTela };
}

describe('procedimento do tipo no documento', () => {
  it('apresenta o aviso recebido e acompanha sua alteração sem decidir a cobertura', async () => {
    const { fixture, elementoDaTela } = await montar({ semProcedimento: true });
    expect(elementoDaTela.textContent).toContain('Falta o procedimento de recurso');
    expect(elementoDaTela.querySelector('select')?.getAttribute('aria-describedby')).toContain(
      'procedimento-NOTA_DA_ETAPA-falta',
    );
    fixture.componentRef.setInput('semProcedimento', false);
    fixture.detectChanges();
    expect(elementoDaTela.textContent).not.toContain('Falta o procedimento de recurso');
    expect(elementoDaTela.querySelector('select')?.getAttribute('aria-describedby')).toBeNull();
  });

  it('não cobra nem oferece declaração sem janela', async () => {
    const { elementoDaTela } = await montar({ temJanela: false });
    expect(elementoDaTela.querySelector('select')).toBeNull();
    expect(elementoDaTela.querySelector('[role="status"]')).toBeNull();
    expect(elementoDaTela.querySelector('input')).toBeNull();
  });

  it('conserva a inconsistência importada sem janela e permite removê-la', async () => {
    const { elementoDaTela } = await montar({
      temJanela: false,
      tipo: tiposNaTela([DECLARADO], [Tipo.NOTA_DA_ETAPA], rotuloDaApi)[0],
    });
    expect(elementoDaTela.querySelector('select')?.disabled).toBe(true);
    expect(elementoDaTela.querySelector('button')?.disabled).toBe(false);
    expect(elementoDaTela.textContent).toContain(CODIGO);
  });

  it('consulta mostra o procedimento em texto, sem controles de edição', async () => {
    const { elementoDaTela } = await montar({
      modo: 'consulta',
      tipo: tiposNaTela([DECLARADO], [Tipo.NOTA_DA_ETAPA], rotuloDaApi)[0],
    });
    expect(elementoDaTela.textContent).toContain(`${CODIGO} — Referência institucional`);
    expect(elementoDaTela.querySelector('select, button, input')).toBeNull();
  });

  it('preserva código e versão fora do catálogo na consulta', async () => {
    const declarado = procedimentoDoDocumento({ regra: { codigo: 'REGRA-ANTIGA', versao: 'v7' } });
    const { fixture, elementoDaTela } = await montar({
      modo: 'consulta',
      tipo: tiposNaTela([declarado], [Tipo.NOTA_DA_ETAPA], rotuloDaApi)[0],
    });
    fixture.componentRef.setInput('regrasDoCatalogo', []);
    fixture.detectChanges();
    expect(elementoDaTela.textContent).toContain('REGRA-ANTIGA');
    expect(declarado.regra).toEqual({ codigo: 'REGRA-ANTIGA', versao: 'v7' });
  });

  it('declara só pela escolha da pessoa e mantém a sugestão fora do documento', async () => {
    const { fixture, elementoDaTela } = await montar({
      sugestao: { codigo: CODIGO, versao: 'v1' },
    });
    const declarar = vi.fn();
    fixture.componentInstance.declarar.subscribe(declarar);
    const seletor = elementoDaTela.querySelector('select') as HTMLSelectElement;
    expect(seletor.value).toBe('');
    expect(elementoDaTela.textContent).toContain('Sugestão:');
    escolher(seletor, CHAVE);
    expect(declarar).toHaveBeenCalledExactlyOnceWith({
      identidade: { tipoDeDecisao: Tipo.NOTA_DA_ETAPA, alvo: null },
      regra: { codigo: CODIGO, versao: 'v1' },
    });
    expect(fixture.componentInstance.tipo().procedimentos).toEqual([]);
  });

  it('não troca o declarado quando a sugestão ou o catálogo mudam', async () => {
    const { fixture, elementoDaTela } = await montar({
      tipo: tiposNaTela([DECLARADO], [Tipo.NOTA_DA_ETAPA], rotuloDaApi)[0],
    });
    const trocar = vi.fn();
    fixture.componentInstance.trocarRegra.subscribe(trocar);
    fixture.componentRef.setInput('sugestao', { codigo: 'OUTRA', versao: 'v2' });
    fixture.componentRef.setInput('regrasDoCatalogo', []);
    fixture.detectChanges();
    expect(elementoDaTela.querySelector('select')?.value).toBe(CHAVE);
    expect(elementoDaTela.textContent).not.toContain('Sugestão:');
    expect(trocar).not.toHaveBeenCalled();
    expect(fixture.componentInstance.tipo().procedimentos[0]).toBe(DECLARADO);
  });

  it('não emite troca para a opção antiga fora do catálogo', async () => {
    const { fixture, elementoDaTela } = await montar({
      regrasDoCatalogo: [],
      tipo: tiposNaTela([DECLARADO], [Tipo.NOTA_DA_ETAPA], rotuloDaApi)[0],
    });
    const trocar = vi.fn();
    fixture.componentInstance.trocarRegra.subscribe(trocar);
    escolher(elementoDaTela.querySelector('select') as HTMLSelectElement, CHAVE);
    expect(trocar).not.toHaveBeenCalled();
  });

  it('mantém duplicatas importadas e remove a ocorrência escolhida', async () => {
    const duplicada = procedimentoDoDocumento({ alvo: ITEM });
    const { fixture, elementoDaTela } = await montar({
      tipo: tiposNaTela([duplicada, duplicada], [Tipo.NOTA_DA_ETAPA], rotuloDaApi)[0],
      alvosOferecidos: [{ alvo: ITEM, rotulo: 'Argumentação' }],
    });
    const remover = vi.fn();
    fixture.componentInstance.remover.subscribe(remover);
    expect(elementoDaTela.querySelectorAll('select')).toHaveLength(2);
    (elementoDaTela.querySelectorAll('button')[1] as HTMLButtonElement).click();
    expect(remover).toHaveBeenCalledExactlyOnceWith({
      tipoDeDecisao: Tipo.NOTA_DA_ETAPA,
      alvo: ITEM,
      ocorrencia: 1,
    });
  });

  it('não sugere par ausente do catálogo mesmo quando o código existe em outra versão', async () => {
    const { elementoDaTela } = await montar({ sugestao: { codigo: CODIGO, versao: 'v2' } });
    expect(elementoDaTela.textContent).not.toContain('Sugestão:');
  });
});
