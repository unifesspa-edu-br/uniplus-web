import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';

import { RecusaDoCampo, RecusaDoCampoComponent } from './recusa-do-campo';

@Component({
  standalone: true,
  imports: [RecusaDoCampoComponent],
  template: `
    <div role="status">
      <label for="titulo">Título</label>
      <input id="titulo" type="text" aria-invalid="true" aria-describedby="titulo-recusa" />
      <ui-recusa-do-campo id="titulo-recusa" [recusas]="recusas" />
    </div>
  `,
})
class AnfitriaoComponent {
  recusas: readonly RecusaDoCampo[] = [];
}

const COM_PAGINA: RecusaDoCampo = {
  codigo: 'uniplus.selecao.edital.vigencia_invalida',
  mensagem: 'A vigência termina antes de começar.',
  pagina: 'https://exemplo.unifesspa.edu.br/erros/uniplus.selecao.edital.vigencia_invalida',
};

const SEM_PAGINA: RecusaDoCampo = {
  codigo: 'uniplus.selecao.edital.titulo_repetido',
  mensagem: 'Já existe um edital com este título.',
  pagina: null,
};

describe('RecusaDoCampoComponent: acessibilidade', () => {
  let fixture: ComponentFixture<AnfitriaoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AnfitriaoComponent] });
    fixture = TestBed.createComponent(AnfitriaoComponent);
    document.body.appendChild(fixture.nativeElement);
  });

  function mostrar(recusas: readonly RecusaDoCampo[]): void {
    fixture.componentInstance.recusas = recusas;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
  }

  async function violacoes(): Promise<unknown[]> {
    const resultado = await axe.run(fixture.nativeElement, {
      rules: { region: { enabled: false } },
    });
    return resultado.violations;
  }

  it('o campo é descrito pela mensagem e pelo código da recusa', () => {
    mostrar([COM_PAGINA]);

    const campo = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const descricao = document.getElementById(campo.getAttribute('aria-describedby') ?? '');
    expect(descricao?.textContent).toContain(COM_PAGINA.mensagem);
    expect(descricao?.textContent).toContain(COM_PAGINA.codigo);
  });

  it.each([
    ['uma recusa com página', [COM_PAGINA]],
    ['uma recusa sem página', [SEM_PAGINA]],
    ['várias recusas, com e sem página', [COM_PAGINA, SEM_PAGINA]],
  ])('não tem violações com %s', async (_nome, recusas) => {
    mostrar(recusas);

    expect(await violacoes()).toEqual([]);
  });
});
