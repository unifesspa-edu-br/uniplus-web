import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { OrigemCandidatosCodigo } from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { EdicoesDoEnemComponent } from './edicoes-do-enem.component';

describe('EdicoesDoEnemComponent', () => {
  let fixture: ComponentFixture<EdicoesDoEnemComponent>;
  let store: ProcessoSeletivoStore;

  const elemento = (seletor: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(seletor);
  const campoDoAno = (): HTMLInputElement => elemento('#f-edicao-enem') as HTMLInputElement;

  function iniciar(edicoesEnem: readonly string[]): void {
    store.patchObjectSection('classificacao', { baseadoEmEnem: true, edicoesEnem });
    fixture.detectChanges();
  }

  function iniciarInscricaoPropria(edicoesEnem: readonly string[]): void {
    store.patchObjectSection('identificacao', {
      origemCandidatos: OrigemCandidatosCodigo.INSCRICAO_PROPRIA,
    });
    iniciar(edicoesEnem);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ProcessoSeletivoStore] });
    store = TestBed.inject(ProcessoSeletivoStore);
    fixture = TestBed.createComponent(EdicoesDoEnemComponent);
  });

  it('acrescenta a edição digitada ao rascunho da classificação', () => {
    iniciar(['2024']);

    campoDoAno().value = '2025';
    campoDoAno().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (elemento('button.btn--secondary') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(store.draft().classificacao.edicoesEnem).toEqual(['2024', '2025']);
    expect(campoDoAno().value).toBe('');
  });

  const aviso = (): HTMLElement | null => elemento('[role="status"] .alert--warning');

  function acrescentar(ano: string): void {
    campoDoAno().value = ano;
    campoDoAno().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (elemento('button.btn--secondary') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('avisa que a edição acrescentada ainda não foi gravada e deixa de avisar depois da gravação', () => {
    iniciarInscricaoPropria(['2024']);
    store.classificacao.edicoesGravadas.set(['2024']);
    fixture.detectChanges();
    expect(elemento('[role="status"]')).not.toBeNull();
    expect(aviso()).toBeNull();

    acrescentar('2025');
    expect(aviso()?.textContent).toContain('ainda não foram gravadas no processo');

    store.classificacao.edicoesGravadas.set(['2024', '2025']);
    fixture.detectChanges();
    expect(aviso()).toBeNull();
  });

  it('não avisa no processo só para consulta', () => {
    iniciarInscricaoPropria(['2024']);
    store.publicacaoNaoConfirmada.set(true);
    fixture.detectChanges();

    expect(store.edicaoPermitida()).toBe(false);
    expect(aviso()).toBeNull();
  });

  it('a recusa do servidor às edições aparece junto da lista e descreve o campo do ano', () => {
    iniciar(['2026']);

    store.classificacao.recusaDasEdicoesDoEnem.set('A edição informada não é aceita.');
    fixture.detectChanges();

    expect(elemento('#edicoes-enem-servidor')?.textContent?.trim()).toBe(
      'A edição informada não é aceita.',
    );
    expect(campoDoAno().getAttribute('aria-describedby')).toContain('edicoes-enem-servidor');
  });
});
