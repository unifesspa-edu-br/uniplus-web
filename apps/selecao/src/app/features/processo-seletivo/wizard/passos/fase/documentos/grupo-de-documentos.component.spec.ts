import { TestBed } from '@angular/core/testing';
import { FormaDeComprovacaoCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it, vi } from 'vitest';

import { regraDoRascunho } from '../../../shared/exigencias/exigencias.testing';
import { GrupoDeDocumentosComponent } from './grupo-de-documentos.component';

const GRUPO = regraDoRascunho({ forma: 'QUANTIDADE_MINIMA_DE_ITENS', quantidadeMinima: 1 });
const ITENS = [
  { identificador: 'rg', nome: 'RG' },
  { identificador: 'cin', nome: 'CIN' },
];
const FORMAS = [
  { codigo: FormaDeComprovacaoCodigo.TODOS_OS_ITENS, rotulo: 'Conjunto completo' },
  { codigo: FormaDeComprovacaoCodigo.QUANTIDADE_MINIMA_DE_ITENS, rotulo: 'Quantidade escolhida' },
];

function montar() {
  const fixture = TestBed.createComponent(GrupoDeDocumentosComponent);
  fixture.componentRef.setInput('grupo', GRUPO);
  fixture.componentRef.setInput('itens', ITENS);
  fixture.componentRef.setInput('disponiveis', [{ identificador: 'cnh', nome: 'CNH' }]);
  fixture.componentRef.setInput('formas', FORMAS);
  fixture.componentRef.setInput('situacao', 'pronto');
  fixture.detectChanges();
  return fixture;
}

describe('GrupoDeDocumentosComponent', () => {
  it('mostra os nomes e as formas recebidas do catálogo', () => {
    const fixture = montar();
    const tela = fixture.nativeElement as HTMLElement;
    expect(tela.querySelector('legend')?.textContent).toContain('Um destes 2 documentos: RG, CIN');
    expect(tela.textContent).toContain('Conjunto completo');
    expect(tela.textContent).toContain('Quantidade escolhida');
  });

  it('desabilita a escolha da forma quando o catálogo falha', () => {
    const fixture = montar();
    const repetir = vi.fn();
    fixture.componentInstance.repetir.subscribe(repetir);
    fixture.componentRef.setInput('situacao', 'falhou');
    fixture.componentRef.setInput('erro', 'Não foi possível carregar.');
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;
    expect(tela.querySelectorAll('fieldset')[1].disabled).toBe(true);
    expect(tela.textContent).toContain('Não foi possível carregar.');
    const falha = tela.querySelector('ui-falha-de-leitura-do-campo');
    expect(falha?.textContent).toContain('Não foi possível carregar.');
    falha?.querySelector<HTMLButtonElement>('button')?.click();
    expect(repetir).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('situacao', 'carregando');
    fixture.componentRef.setInput('erro', null);
    fixture.detectChanges();
    expect(falha?.textContent).toContain('Não foi possível carregar.');
  });

  it('associa o erro ao campo e não emite quantidade inválida', () => {
    const fixture = montar();
    const emitir = vi.fn();
    fixture.componentInstance.quantidadeChange.subscribe(emitir);
    const campo = (fixture.nativeElement as HTMLElement).querySelector(
      'input[type=number]',
    ) as HTMLInputElement;
    campo.value = '3';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toContain('erro-');
    expect(emitir).not.toHaveBeenCalled();
  });

  it('emite as escolhas de forma e quantidade', () => {
    const fixture = montar();
    const forma = vi.fn();
    const quantidade = vi.fn();
    fixture.componentInstance.formaChange.subscribe(forma);
    fixture.componentInstance.quantidadeChange.subscribe(quantidade);
    fixture.componentInstance.escolherForma('TODOS_OS_ITENS');
    fixture.componentInstance.escolherQuantidade('2');
    expect(forma).toHaveBeenCalledWith('TODOS_OS_ITENS');
    expect(quantidade).toHaveBeenCalledWith(2);
  });

  it('emite os documentos a retirar e incluir', () => {
    const fixture = montar();
    const retirar = vi.fn();
    const incluir = vi.fn();
    fixture.componentInstance.retirar.subscribe(retirar);
    fixture.componentInstance.incluir.subscribe(incluir);
    const tela = fixture.nativeElement as HTMLElement;
    (tela.querySelector('[aria-label="Retirar do grupo: RG"]') as HTMLButtonElement).click();
    fixture.componentInstance.documentoEscolhido.set('cnh');
    fixture.detectChanges();
    [...tela.querySelectorAll('button')]
      .find((botao) => botao.textContent?.includes('Incluir documento'))
      ?.click();
    expect(retirar).toHaveBeenCalledWith('rg');
    expect(incluir).toHaveBeenCalledWith('cnh');
  });
});
