import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ModeloFormularioCabecalhoComponent } from './modelo-formulario-cabecalho.component';

describe('ModeloFormularioCabecalhoComponent', () => {
  function montar(): ModeloFormularioCabecalhoComponent {
    TestBed.configureTestingModule({
      imports: [ModeloFormularioCabecalhoComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(ModeloFormularioCabecalhoComponent);
    fixture.componentRef.setInput('modelo', null);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('o rótulo da finalidade volta ao valor quando ela não está no catálogo', () => {
    const componente = montar();

    expect(componente.rotuloDaFinalidade('INSCRICAO')).not.toBe('INSCRICAO');
    expect(componente.rotuloDaFinalidade('OUTRA')).toBe('OUTRA');
  });
});
