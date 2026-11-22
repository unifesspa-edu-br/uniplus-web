import { HttpHeaders } from '@angular/common/http';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { apiFailure, apiOk } from '@uniplus/shared-core/http';
import { FasesCanonicasApi } from '@uniplus/shared-data/configuracao';
import { CronogramaDoProcessoApi } from '@uniplus/shared-data/selecao';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConducaoDoWizard } from './editor/conducao-do-wizard.service';
import { ProcessoSeletivoPage } from './processo-seletivo.page';
import type { PassoDoWizard } from './wizard/passo-do-wizard';
import type { ProcessoSeletivoStore } from './wizard/processo-seletivo.store';
import { PAGE_PROVIDERS } from './processo-seletivo.page.testing';
import { CronogramaPassoComponent } from './wizard/passos/cronograma/cronograma.component';
import { FASES_CANONICAS, ID_RESULTADO } from './wizard/passos/cronograma/cronograma.testing';
import { umaFaseDoCronograma } from './wizard/shared/fase-do-cronograma.testing';

const FASE_NO_CATALOGO = FASES_CANONICAS.find((fase) => fase.id === ID_RESULTADO);
const PASSO_DO_CRONOGRAMA = 4;
const PASSO_SEGUINTE = 5;
const RECUSA = {
  type: 'https://erros.exemplo.unifesspa.edu.br/erros/uniplus.validacao',
  code: 'uniplus.validacao',
  title: 'Validação',
  status: 422,
  traceId: '',
  errors: [
    {
      field: 'fases[0].produtos[0]',
      code: 'uniplus.selecao.produto_da_fase.ato_nao_encontrado_no_catalogo',
      message: 'Sem ato.',
    },
  ],
};

async function abrirNoCronograma() {
  TestBed.configureTestingModule({
    imports: [ProcessoSeletivoPage],
    providers: [
      ...PAGE_PROVIDERS,
      // A página leva a rota ao processo em edição; sem destino, a navegação falharia sem relação com o teste.
      provideRouter([{ path: '**', children: [] }]),
      // A fase precisa estar no catálogo para a tela mostrar o que ela exige e abrir a configuração.
      {
        provide: FasesCanonicasApi,
        useValue: { listar: () => of(apiOk([FASE_NO_CATALOGO], 200, new HttpHeaders())) },
      },
      {
        provide: CronogramaDoProcessoApi,
        useValue: {
          definirCronogramaFases: () => of(apiFailure(RECUSA, 422, new HttpHeaders())),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ProcessoSeletivoPage);
  const store = fixture.componentInstance.store;
  store.processoSeletivoId.set('processo-1');
  store.patchObjectSection('cronograma', {
    fases: [
      umaFaseDoCronograma({ faseCanonicaId: ID_RESULTADO, codigo: 'RESULTADO_FINAL', ordem: 1 }),
    ],
  });
  store.goTo(PASSO_DO_CRONOGRAMA);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, store };
}

/** Os passos que a página conduz: o Cronograma é o real, a Revisão é a que o caso traz, os demais não têm pendência. */
function conduzirComARevisao(
  fixture: ComponentFixture<ProcessoSeletivoPage>,
  store: ProcessoSeletivoStore,
  revisao: PassoDoWizard,
): void {
  const cronograma = fixture.debugElement.query(By.directive(CronogramaPassoComponent))
    .componentInstance as CronogramaPassoComponent;
  const semPendencia = { validar: () => ({ valid: true }) };
  vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
    (index: number) => {
      if (index === PASSO_DO_CRONOGRAMA) return cronograma;
      return index === store.totalDePassos - 1 ? revisao : semPendencia;
    },
  );
}

const pendenciaDaGravacaoRecusada = (pendencias: readonly string[]): boolean =>
  pendencias.some(
    (pendencia) =>
      pendencia.startsWith(`Passo ${PASSO_DO_CRONOGRAMA + 1}`) &&
      pendencia.includes('A gravação do cronograma foi recusada'),
  );

describe('ProcessoSeletivoPage: recusas da gravação das fases ao sair do passo Cronograma', () => {
  afterEach(() => TestBed.resetTestingModule());

  const recusaNaTela = (fixture: ComponentFixture<ProcessoSeletivoPage>) =>
    (fixture.nativeElement as HTMLElement).querySelector('#fase-RESULTADO_FINAL-produtos-erro');

  const gravarRecusado = async (fixture: ComponentFixture<ProcessoSeletivoPage>) => {
    const passo = fixture.debugElement.query(By.directive(CronogramaPassoComponent));
    await (passo.componentInstance as CronogramaPassoComponent).persistir();
    fixture.detectChanges();
  };

  it('mostra a recusa no campo enquanto o passo está na tela', async () => {
    const { fixture } = await abrirNoCronograma();

    await gravarRecusado(fixture);

    expect(recusaNaTela(fixture)?.textContent).toContain('Sem ato.');
  });

  it('descarta a recusa ao ir a outro passo, e ela não volta ao regressar', async () => {
    const { fixture, store } = await abrirNoCronograma();
    await gravarRecusado(fixture);

    store.goTo(PASSO_SEGUINTE);
    fixture.detectChanges();
    store.goTo(PASSO_DO_CRONOGRAMA);
    fixture.detectChanges();

    expect(recusaNaTela(fixture)).toBeNull();
  });

  it('não publica, e conta como pendência do Cronograma, a gravação recusada só com recusas de campo', async () => {
    const { fixture, store } = await abrirNoCronograma();
    const publicacao = vi.fn(() => Promise.resolve({ valid: true }));
    conduzirComARevisao(fixture, store, {
      validar: () => ({ valid: true }),
      persistir: publicacao,
    });
    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();

    await fixture.componentInstance.nextOrPublish();

    expect(publicacao).not.toHaveBeenCalled();
    expect(pendenciaDaGravacaoRecusada(store.erroDoPasso() ?? [])).toBe(true);
  });
});
