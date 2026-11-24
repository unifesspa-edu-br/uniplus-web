import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ModeloFormularioCabecalhoComponent } from './modelo-formulario-cabecalho.component';
import { modelo } from './modelo-formulario-edicao.page.testing';

describe('ModeloFormularioCabecalhoComponent', () => {
  it('mostra a finalidade recebida', () => {
    TestBed.configureTestingModule({
      imports: [ModeloFormularioCabecalhoComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(ModeloFormularioCabecalhoComponent);
    fixture.componentRef.setInput('modelo', modelo);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(modelo.finalidade.rotulo);
  });
});
