import { ResultadoDaDecisaoCodigo } from '@uniplus/shared-data/autorizacao';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { VersaoPendenteDto } from '@uniplus/shared-data/autorizacao';
import { beforeEach, describe, expect, it } from 'vitest';
import { ETAPA_GESTAO, ETAPA_PROTECAO, resultadoDaDecisao } from './enums-da-api.testing';
import { versaoPendente } from './perfis.testing';
import { ResumoDaVersaoComponent } from './resumo-da-versao.component';

type Decisao = VersaoPendenteDto['decisoes'][number];

function decisao(resultado: Decisao['resultado']): Decisao {
  return {
    etapa: ETAPA_GESTAO,
    resultado,
    nome: 'Operador de inscrições',
    temConcessao: false,
    instante: '2026-11-11T13:40:00Z',
  };
}

describe('ResumoDaVersaoComponent', () => {
  let fixture: ComponentFixture<ResumoDaVersaoComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ResumoDaVersaoComponent);
  });

  function abrir(versao: VersaoPendenteDto): HTMLElement {
    fixture.componentRef.setInput('versao', versao);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function etiquetaDaDecisao(host: HTMLElement): Element | null | undefined {
    return [...host.querySelectorAll('h3')]
      .find((titulo) => titulo.textContent?.trim() === 'Decisões sobre esta versão')
      ?.parentElement?.querySelector('ui-tag-do-codigo .tag');
  }

  it.each([
    [ResultadoDaDecisaoCodigo.APROVADO, 'Aprovado', 'success'],
    [ResultadoDaDecisaoCodigo.RECUSADO, 'Recusado', 'danger'],
    [ResultadoDaDecisaoCodigo.PERFIL_ALTERADO, 'Perfil alterado', 'warning'],
    [ResultadoDaDecisaoCodigo.PRAZO_VENCIDO, 'Prazo vencido', 'warning'],
    [ResultadoDaDecisaoCodigo.TERMO_EXIGIDO, 'Termo exigido', 'warning'],
  ] as const)('mostra a decisão %s com o rótulo da API "%s" na cor %s', (codigo, rotulo, cor) => {
    const host = abrir(versaoPendente({ decisoes: [decisao(resultadoDaDecisao(codigo))] }));

    const etiqueta = etiquetaDaDecisao(host);

    expect(etiqueta?.textContent?.trim()).toBe(rotulo);
    expect(etiqueta?.classList).toContain(`tag--${cor}`);
  });

  it('deixa neutro o resultado que a tela não conhece, sem tratá-lo como recusa', () => {
    const desconhecido = {
      codigo: 'OUTRO',
      rotulo: 'Outro resultado',
    } as unknown as Decisao['resultado'];

    const etiqueta = etiquetaDaDecisao(
      abrir(versaoPendente({ decisoes: [decisao(desconhecido)] })),
    );

    expect(etiqueta?.textContent?.trim()).toBe('Outro resultado');
    expect(etiqueta?.classList).toContain('tag--neutral');
  });

  function valorDe(host: HTMLElement, termo: string): string | undefined {
    const rotulo = [...host.querySelectorAll('dt')].find((dt) => dt.textContent?.trim() === termo);
    return rotulo?.nextElementSibling?.textContent?.replace(/\s+/g, ' ').trim();
  }

  it('mostra a etapa atual e a situação do documento com o rótulo da API', () => {
    const host = abrir(versaoPendente());

    expect(valorDe(host, 'Etapa atual')).toBe('Gestão de acessos');
    expect(valorDe(host, 'Documento instituidor')).toContain('Verificado');
  });

  it.each([
    [[ETAPA_GESTAO, ETAPA_PROTECAO], 'Gestão de acessos, Proteção de dados'],
    [[ETAPA_GESTAO], 'Gestão de acessos'],
  ])('nomeia as etapas exigidas que a API envia: %j', (etapas, texto) => {
    const host = abrir(versaoPendente({ etapasExigidas: etapas }));

    expect(valorDe(host, 'Aprovações exigidas')).toBe(texto);
  });
});
