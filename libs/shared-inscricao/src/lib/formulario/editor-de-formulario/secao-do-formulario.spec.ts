import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { expect, it, vi } from 'vitest';
import { EditorDeCondicoesComponent } from '../editor-de-condicoes/editor-de-condicoes';
import { secao } from './modelo/conteudos-de-exemplo.testing';
import { SecaoDoFormularioComponent } from './secao-do-formulario';

function montar(titulo = 'Identificação') {
  const fixture = TestBed.createComponent(SecaoDoFormularioComponent);
  const pagina = secao('S1', 0);
  fixture.componentRef.setInput('pagina', {
    ...pagina,
    apresentacao: { ...pagina.apresentacao, titulo },
  });
  fixture.componentRef.setInput('fatos', []);
  fixture.componentRef.setInput('idBase', 'secao');
  fixture.detectChanges();
  return fixture;
}

it('aponta título composto apenas por espaços como inválido', () => {
  const fixture = montar('  ');
  const titulo = fixture.nativeElement.querySelector('#secao-titulo') as HTMLInputElement;
  expect(titulo.getAttribute('aria-invalid')).toBe('true');
  expect(fixture.nativeElement.textContent).toContain('A seção precisa de título.');
});

it('emite título editado e o caminho do campo', () => {
  const fixture = montar();
  const pagina = vi.fn();
  const campos = vi.fn();
  fixture.componentInstance.paginaChange.subscribe(pagina);
  fixture.componentInstance.camposEditados.subscribe(campos);
  const titulo = fixture.nativeElement.querySelector('#secao-titulo') as HTMLInputElement;
  titulo.value = 'Dados';
  titulo.dispatchEvent(new Event('input'));
  expect(pagina.mock.calls[0][0].apresentacao.titulo).toBe('Dados');
  expect(campos).toHaveBeenCalledWith([['apresentacao', 'titulo']]);
});

it('converte descrição em branco para nulo', () => {
  const fixture = montar();
  const receber = vi.fn();
  fixture.componentInstance.paginaChange.subscribe(receber);
  const descricao = fixture.nativeElement.querySelector('#secao-descricao') as HTMLTextAreaElement;
  descricao.value = '  ';
  descricao.dispatchEvent(new Event('input'));
  expect(receber.mock.calls[0][0].apresentacao.descricao).toBeNull();
});

it('emite mudança da condição de exibição', () => {
  const fixture = montar();
  const receber = vi.fn();
  fixture.componentInstance.camposEditados.subscribe(receber);
  const editor = fixture.debugElement.query(By.directive(EditorDeCondicoesComponent));
  editor.componentInstance.condicoesChange.emit([]);
  expect(receber).toHaveBeenCalledWith([['exibicao']]);
});
