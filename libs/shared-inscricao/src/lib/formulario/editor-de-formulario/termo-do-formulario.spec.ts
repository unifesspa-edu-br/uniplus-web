import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { expect, it, vi } from 'vitest';
import { EditorDeCondicoesComponent } from '../editor-de-condicoes/editor-de-condicoes';
import { TermoDoFormularioComponent } from './termo-do-formulario';

const termo = {
  codigo: 'T',
  ordem: 0,
  termo: { termoId: 'T', versaoId: 'V1' },
  regras: { exibicao: null, obrigatoriedade: { tipo: 'SEMPRE', predicado: null } },
};

function montar() {
  const fixture = TestBed.createComponent(TermoDoFormularioComponent);
  fixture.componentRef.setInput('termo', termo);
  fixture.componentRef.setInput('posicao', 1);
  fixture.componentRef.setInput('fatos', []);
  fixture.componentRef.setInput('idBase', 'termo');
  fixture.detectChanges();
  return fixture;
}

it('mantém versão gravada quando o termo saiu do catálogo', () => {
  const fixture = montar();
  expect(fixture.nativeElement.textContent).toContain('Termo fora do catálogo');
  expect(fixture.nativeElement.textContent).toContain('Versão gravada (fora do catálogo)');
});

it('emite a versão escolhida e o caminho editado', () => {
  const fixture = montar();
  const receber = vi.fn();
  fixture.componentInstance.camposEditados.subscribe(receber);
  fixture.componentRef.setInput('disponivel', {
    nome: 'Termo',
    versoes: [{ versaoId: 'V2', rotulo: 'Nova' }],
  });
  fixture.detectChanges();
  const seletor = fixture.nativeElement.querySelector('#termo-versao') as HTMLSelectElement;
  seletor.value = 'V2';
  seletor.dispatchEvent(new Event('change'));
  expect(receber).toHaveBeenCalledWith([['termo', 'versaoId']]);
});

it('remove predicado ao tornar o aceite opcional', () => {
  const fixture = montar();
  const receber = vi.fn();
  fixture.componentInstance.termoChange.subscribe(receber);
  const seletor = fixture.nativeElement.querySelector('#termo-aceite') as HTMLSelectElement;
  seletor.value = 'NUNCA';
  seletor.dispatchEvent(new Event('change'));
  expect(receber.mock.calls[0][0].regras.obrigatoriedade).toEqual({
    tipo: 'NUNCA',
    predicado: null,
  });
});

it('emite condição de exibição editada', () => {
  const fixture = montar();
  const receber = vi.fn();
  fixture.componentInstance.camposEditados.subscribe(receber);
  fixture.debugElement
    .query(By.directive(EditorDeCondicoesComponent))
    .componentInstance.condicoesChange.emit([]);
  expect(receber).toHaveBeenCalledWith([['regras', 'exibicao']]);
});
