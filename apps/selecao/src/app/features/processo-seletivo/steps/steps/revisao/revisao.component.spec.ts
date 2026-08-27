import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it } from 'vitest';

import { REVIEW_NAMES } from '../../processo-seletivo.data';
import { FaseUpload, UploadItem } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicialService } from '../../shared/cadastro-inicial.service';
import { RevisaoStepComponent } from './revisao.component';

function anexo(fase: FaseUpload): UploadItem {
  return { id: 'u1', name: 'edital.pdf', extension: 'pdf', progress: 100, fase };
}

describe('RevisaoStepComponent', () => {
  let componente: RevisaoStepComponent;
  let store: ProcessoSeletivoStore;
  let host: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RevisaoStepComponent],
      providers: [
        ProcessoSeletivoStore,
        CadastroInicialService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: 'http://localhost:5000' },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RevisaoStepComponent);
    componente = fixture.componentInstance;
    store = TestBed.inject(ProcessoSeletivoStore);
    host = fixture.nativeElement as HTMLElement;
    detectar = () => fixture.detectChanges();
    detectar();
  });

  /** Todos os passos do wizard visitados e concluídos. */
  function concluirTodosOsPassos(): void {
    store.completedSteps.set(new Set(REVIEW_NAMES.map((_, index) => index)));
  }

  function anexarEdital(fase: FaseUpload): void {
    store.patchObjectSection('identificacao', { uploads: [anexo(fase)] });
  }

  /**
   * O painel prometia publicação e a validação recusava no clique seguinte:
   * a conta ignorava o edital, que é justamente o que `validate()` cobra.
   */
  it('não anuncia prontidão enquanto o edital não foi anexado', () => {
    concluirTodosOsPassos();
    detectar();

    expect(componente.pronto()).toBe(false);
    expect(componente.percent()).toBeLessThan(100);
    expect(host.textContent).not.toContain('Tudo pronto para publicar!');
    expect(componente.validate().valid).toBe(false);
  });

  it('não anuncia prontidão enquanto o envio do edital não terminou', () => {
    concluirTodosOsPassos();
    anexarEdital('enviando');
    detectar();

    expect(componente.pronto()).toBe(false);
    expect(componente.validate().valid).toBe(false);
  });

  it('anuncia prontidão quando os passos e o edital estão completos', () => {
    concluirTodosOsPassos();
    anexarEdital('confirmado');
    detectar();

    expect(componente.pronto()).toBe(true);
    expect(componente.percent()).toBe(100);
    expect(host.textContent).toContain('Tudo pronto para publicar!');
    expect(componente.validate().valid).toBe(true);
  });

  /** O painel e a recusa precisam contar a mesma história em qualquer estado. */
  it('mantém o painel e a validação de acordo', () => {
    const estados: FaseUpload[] = ['iniciando', 'enviando', 'confirmando', 'erro', 'confirmado'];
    concluirTodosOsPassos();

    for (const fase of estados) {
      anexarEdital(fase);
      detectar();
      expect(componente.pronto()).toBe(componente.validate().valid);
    }
  });

  it('conta o edital como requisito ao lado dos passos', () => {
    expect(componente.totalRequisitos).toBe(REVIEW_NAMES.length + 1);

    concluirTodosOsPassos();
    detectar();
    expect(componente.atendidos()).toBe(REVIEW_NAMES.length);
    expect(componente.pending()).toBe(1);
  });
});
