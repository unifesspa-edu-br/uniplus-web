import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { ComprovanteDaInscricaoComponent } from './comprovante-da-inscricao.component';
import { comprovanteBase } from './comprovante-da-inscricao.testing';

const termo = (formularioCodigo: string, nome: string) => ({
  formularioCodigo,
  codigo: 'VERACIDADE',
  nome,
  versaoId: '0199e000-0000-7000-8000-0000000000a2',
  hashVersao: 'sha256-v1',
});

function montar(termosAceitos: ReturnType<typeof termo>[]): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(ComprovanteDaInscricaoComponent);
  const base = comprovanteBase();
  fixture.componentRef.setInput('comprovante', {
    ...base,
    formulario: { ...base.formulario, termosAceitos },
  });
  fixture.componentRef.setInput('rotaDoEnvio', (numero: number) => ['/envio', numero]);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ComprovanteDaInscricaoComponent: termos aceitos', () => {
  it('com dois formulários, lista cada termo aceito, mesmo com o mesmo código', () => {
    const tela = montar([
      termo('DADOS_PESSOAIS', 'Veracidade pessoal'),
      termo('DADOS_ACADEMICOS', 'Veracidade acadêmica'),
    ]);

    const nomes = [...tela.querySelectorAll('ul.u-list li')].map((li) => li.textContent?.trim());
    expect(nomes).toEqual(['Veracidade pessoal', 'Veracidade acadêmica']);
  });

  it('não mostra o código interno do formulário', () => {
    const tela = montar([termo('INSCRICAO', 'Declaração de veracidade')]);

    expect(tela.textContent).toContain('Declaração de veracidade');
    expect(tela.textContent).not.toContain('INSCRICAO');
  });
});
