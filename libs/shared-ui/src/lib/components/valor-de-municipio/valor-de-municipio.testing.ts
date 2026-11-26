import { TestBed } from '@angular/core/testing';

import { ValorDeMunicipioComponent, type MunicipioEncontrado } from './valor-de-municipio';

export const MARABA: MunicipioEncontrado = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };

export function montarCampoDeMunicipio(multiplo: boolean) {
  const fixture = TestBed.createComponent(ValorDeMunicipioComponent);
  fixture.componentRef.setInput('rotulo', 'Município');
  fixture.componentRef.setInput('values', []);
  fixture.componentRef.setInput('uf', 'PA');
  fixture.componentRef.setInput('multiplo', multiplo);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  const raiz = fixture.nativeElement as HTMLElement;
  const campo = raiz.querySelector('input[role="combobox"]') as HTMLInputElement;
  return { fixture, raiz, campo };
}
