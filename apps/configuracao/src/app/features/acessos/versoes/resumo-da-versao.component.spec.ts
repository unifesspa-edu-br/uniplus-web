import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { VersaoPendenteDto } from '@uniplus/shared-data/autorizacao';
import { beforeEach, describe, expect, it } from 'vitest';
import { versaoPendente } from './perfis.testing';
import { ResumoDaVersaoComponent } from './resumo-da-versao.component';
import { resultadoDaDecisao } from './rotulos-da-versao';

type Decisao = VersaoPendenteDto['decisoes'][number];

function decisao(resultado: string): Decisao {
  return { etapa: 'gestao_de_acessos', resultado, nome: 'Operador de inscrições', temConcessao: false, instante: '2026-11-11T13:40:00Z' };
}

describe('resultadoDaDecisao', () => {
  it.each([
    ['aprovado', 'Aprovado', 'success'],
    ['recusado', 'Recusado', 'danger'],
    ['perfil_alterado', 'Perfil alterado antes da decisão', 'warning'],
    ['prazo_vencido', 'Prazo vencido', 'warning'],
  ] as const)('mostra %s como "%s" na cor %s', (codigo, texto, variante) => {
    expect(resultadoDaDecisao(codigo)).toEqual({ texto, variante });
  });

  it('deixa neutro o resultado que a tela não conhece, sem tratá-lo como recusa', () => {
    expect(resultadoDaDecisao('outro')).toEqual({ texto: 'outro', variante: 'neutral' });
  });
});

describe('ResumoDaVersaoComponent', () => {
  let fixture: ComponentFixture<ResumoDaVersaoComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ResumoDaVersaoComponent);
  });

  it('mostra a decisão aprovada pela gestão de acessos como sucesso', () => {
    fixture.componentRef.setInput('versao', versaoPendente({ decisoes: [decisao('aprovado')] }));
    fixture.detectChanges();

    const decisoes = [...(fixture.nativeElement as HTMLElement).querySelectorAll('h3')].find(
      (titulo) => titulo.textContent?.trim() === 'Decisões desta rodada',
    )?.parentElement;
    const tag = decisoes?.querySelector('ui-tag .tag');

    expect(tag?.textContent?.trim()).toBe('Aprovado');
    expect(tag?.classList).toContain('tag--success');
  });
});
