import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ParametrosDoRecursoEmConsultaComponent } from './parametros-do-recurso-em-consulta.component';
import {
  PARAMETROS_COM_INSTANCIA_SUPERIOR,
  PARAMETROS_SEM_INSTANCIA_SUPERIOR,
  umaLeituraDoRecurso,
} from './parametros-do-recurso.testing';
import type { LeituraDoRecurso, ParametrosDoRecurso } from './parametros-do-recurso';

function montar(parametros: ParametrosDoRecurso, leitura: LeituraDoRecurso): HTMLElement {
  const fixture = TestBed.createComponent(ParametrosDoRecursoEmConsultaComponent);
  fixture.componentRef.setInput('parametros', parametros);
  fixture.componentRef.setInput('leitura', leitura);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const texto = (raiz: HTMLElement) => (raiz.textContent ?? '').replace(/\s+/g, ' ');

describe('ParametrosDoRecursoEmConsultaComponent', () => {
  const rotulos = {
    prazoUnidade: 'Dias úteis',
    efeitoSuspensivo: 'Sem efeito suspensivo',
    guardaDaVaga: 'Guarda a vaga até o resultado definitivo',
  };

  it('mostra cada parâmetro com o nome que a leitura devolveu', () => {
    const conteudo = texto(
      montar(PARAMETROS_SEM_INSTANCIA_SUPERIOR, umaLeituraDoRecurso({ rotulos })),
    );

    expect(conteudo).toContain('Prazo de interposição');
    expect(conteudo).toContain('2 — Dias úteis');
    expect(conteudo).toContain('Efeito suspensivo na 1ª instância');
    expect(conteudo).toContain('Sem efeito suspensivo');
    expect(conteudo).toContain('Guarda da vaga em disputa');
    expect(conteudo).toContain('Guarda a vaga até o resultado definitivo');
  });

  it('não mostra o prazo da 2ª instância quando não há prazo gravado', () => {
    const conteudo = texto(
      montar(PARAMETROS_SEM_INSTANCIA_SUPERIOR, umaLeituraDoRecurso({ rotulos })),
    );

    expect(conteudo).not.toContain('Prazo para recorrer em 2ª instância');
  });

  it('mostra o prazo da 2ª instância gravado, mesmo sem instância superior', () => {
    const gravado = {
      ...PARAMETROS_SEM_INSTANCIA_SUPERIOR,
      prazoSegundaInstanciaValor: '3',
      prazoSegundaInstanciaUnidade: PARAMETROS_COM_INSTANCIA_SUPERIOR.prazoSegundaInstanciaUnidade,
    };

    const conteudo = texto(montar(gravado, umaLeituraDoRecurso({ rotulos })));

    expect(conteudo).toContain('Prazo para recorrer em 2ª instância');
    expect(conteudo).toContain('3 — diasUteis');
  });

  it('não oferece controle algum: é só leitura', () => {
    const raiz = montar(PARAMETROS_COM_INSTANCIA_SUPERIOR, umaLeituraDoRecurso({ rotulos }));

    expect(raiz.querySelectorAll('input, select, button, textarea')).toHaveLength(0);
  });
});
