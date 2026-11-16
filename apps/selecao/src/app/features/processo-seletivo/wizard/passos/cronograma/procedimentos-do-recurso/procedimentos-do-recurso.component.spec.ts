import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RegrasCatalogoApi } from '@uniplus/shared-data/selecao';
import { describe, expect, it, vi } from 'vitest';

import type { ProcedimentoDeRecurso } from '../../../processo-seletivo.models';
import { CatalogoDeRegras } from '../catalogos/catalogo-de-regras.service';
import { ProcedimentosDoRecursoComponent } from './procedimentos-do-recurso.component';
import { procedimento, regraDoCatalogo } from './procedimentos.testing';

@Component({
  imports: [ProcedimentosDoRecursoComponent],
  template: `<sel-procedimentos-do-recurso
    class="form-grid__full"
    [procedimentos]="procedimentos()"
    idDoTitulo="titulo-de-teste"
  />`,
})
class AnfitriaComponent {
  readonly procedimentos = signal<readonly ProcedimentoDeRecurso[]>([]);
}

function montar(procedimentos: readonly ProcedimentoDeRecurso[], carregarCatalogo = true) {
  TestBed.configureTestingModule({
    providers: [CatalogoDeRegras, { provide: RegrasCatalogoApi, useValue: { listar: vi.fn() } }],
  });
  if (carregarCatalogo) {
    TestBed.inject(CatalogoDeRegras).regrasProcedimento.set([
      regraDoCatalogo('PROCEDIMENTO-RECURSO-MONOCRATICO', 'Resolução 12/2020'),
    ]);
  }
  const fixture = TestBed.createComponent(AnfitriaComponent);
  fixture.componentInstance.procedimentos.set(procedimentos);
  fixture.detectChanges();
  const host = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
    'sel-procedimentos-do-recurso',
  ) as HTMLElement;
  return { fixture, host };
}

describe('ProcedimentosDoRecursoComponent', () => {
  it('fica oculto quando o recurso não declara procedimento', () => {
    const { host } = montar([]);

    expect(host.hidden).toBe(true);
    expect(host.querySelector('ul')).toBeNull();
  });

  it('lista cada procedimento declarado, ligado ao título da lista', () => {
    const { host } = montar([procedimento(), procedimento({ tipoDeDecisao: 'RESULTADO_FINAL' })]);

    const lista = host.querySelector('ul') as HTMLElement;
    expect(host.hidden).toBe(false);
    expect(lista.getAttribute('aria-labelledby')).toBe('titulo-de-teste');
    expect(host.querySelector('#titulo-de-teste')).not.toBeNull();
    expect(lista.querySelectorAll('li')).toHaveLength(2);
  });

  it('mostra "Sugestão: código — base legal" só quando o servidor a traz', () => {
    const { host } = montar([
      procedimento({ sugestao: 'PROCEDIMENTO-RECURSO-MONOCRATICO' }),
      procedimento({ tipoDeDecisao: 'RESULTADO_FINAL' }),
    ]);

    const dicas = [...host.querySelectorAll('.field__hint')].map((dica) =>
      dica.textContent?.trim(),
    );
    expect(dicas).toEqual(['Sugestão: PROCEDIMENTO-RECURSO-MONOCRATICO — Resolução 12/2020']);
  });

  it('mostra o código da sugestão enquanto o catálogo não foi carregado', () => {
    const { host } = montar(
      [procedimento({ sugestao: 'PROCEDIMENTO-RECURSO-MONOCRATICO' })],
      false,
    );

    expect(host.querySelector('.field__hint')?.textContent?.trim()).toBe(
      'Sugestão: PROCEDIMENTO-RECURSO-MONOCRATICO',
    );
  });

  it('é só leitura: não oferece campo nem botão para trocar o procedimento', () => {
    const { host } = montar([procedimento({ sugestao: 'PROCEDIMENTO-RECURSO-MONOCRATICO' })]);

    expect(host.querySelector('input, select, textarea, button')).toBeNull();
  });
});
