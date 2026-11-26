import { HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { apiOk } from '@uniplus/shared-core/http';
import { FasesCanonicasApi } from '@uniplus/shared-data/configuracao';
import { CronogramaDoProcessoApi, type FaseCronogramaInput } from '@uniplus/shared-data/selecao';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConducaoDoWizard } from './editor/conducao-do-wizard.service';
import { ProcessoSeletivoPage } from './processo-seletivo.page';
import { PAGE_PROVIDERS } from './processo-seletivo.page.testing';
import { CronogramaPassoComponent } from './wizard/passos/cronograma/cronograma.component';
import { FASES_CANONICAS, ID_RESULTADO } from './wizard/passos/cronograma/cronograma.testing';
import { GravacaoDasExigenciasDocumentais } from './wizard/passos/cronograma/servicos/gravacao-das-exigencias-documentais.service';
import { ReleituraDosIdentificadores } from './wizard/passos/cronograma/servicos/releitura-dos-identificadores.service';
import { umaFaseDoCronograma } from './wizard/shared/fase-do-cronograma.testing';
import { regraDoDto } from './wizard/shared/homologacao/regra-de-homologacao-contrato';
import {
  EDICOES_DA_REGRA_DO_SERVIDOR,
  REGRA_DE_HOMOLOGACAO_DO_SERVIDOR,
} from './wizard/shared/homologacao/regra-de-homologacao.testing';

const FASE_NO_CATALOGO = FASES_CANONICAS.find((fase) => fase.id === ID_RESULTADO);
const PASSO_DO_CRONOGRAMA = 4;
const SEM_CONTEUDO = apiOk(null, 204, new HttpHeaders());

async function abrirNoCronogramaComARegra() {
  const definirCronogramaFases = vi.fn(() => of(SEM_CONTEUDO));
  TestBed.configureTestingModule({
    imports: [ProcessoSeletivoPage],
    providers: [
      ...PAGE_PROVIDERS,
      provideRouter([{ path: '**', children: [] }]),
      {
        provide: FasesCanonicasApi,
        useValue: { listar: () => of(apiOk([FASE_NO_CATALOGO], 200, new HttpHeaders())) },
      },
      {
        provide: CronogramaDoProcessoApi,
        useValue: { definirCronogramaFases, definirEtapas: () => of(SEM_CONTEUDO) },
      },
    ],
  });
  const fixture = TestBed.createComponent(ProcessoSeletivoPage);
  const { store } = fixture.componentInstance;
  store.processoSeletivoId.set('processo-1');
  store.patchObjectSection('classificacao', { edicoesEnem: [...EDICOES_DA_REGRA_DO_SERVIDOR] });
  store.patchObjectSection('cronograma', {
    fases: [
      umaFaseDoCronograma({
        faseCanonicaId: ID_RESULTADO,
        codigo: 'HOMOLOGACAO_INSCRICOES',
        ordem: 1,
        regraDeHomologacao: regraDoDto(REGRA_DE_HOMOLOGACAO_DO_SERVIDOR),
      }),
    ],
  });
  store.goTo(PASSO_DO_CRONOGRAMA);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, store, definirCronogramaFases };
}

describe('ProcessoSeletivoPage: a publicação regrava o Cronograma sem mudar a regra de homologação', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('envia a mesma regra ao regravar o passo e depois chama a publicação', async () => {
    const { fixture, store, definirCronogramaFases } = await abrirNoCronogramaComARegra();
    const passo = fixture.debugElement.query(By.directive(CronogramaPassoComponent));
    const cronograma = passo.componentInstance as CronogramaPassoComponent;
    vi.spyOn(passo.injector.get(ReleituraDosIdentificadores), 'recolher').mockResolvedValue(
      'confere',
    );
    vi.spyOn(passo.injector.get(GravacaoDasExigenciasDocumentais), 'gravar').mockResolvedValue({
      valid: true,
    });
    const publicacao = vi.fn(() => Promise.resolve({ valid: true }));
    const semPendencia = { validar: () => ({ valid: true }) };
    const revisao = { validar: () => ({ valid: true }), persistir: publicacao };
    vi.spyOn(fixture.debugElement.injector.get(ConducaoDoWizard), 'passoNo').mockImplementation(
      (indice: number) => {
        if (indice === PASSO_DO_CRONOGRAMA) return cronograma;
        return indice === store.totalDePassos - 1 ? revisao : semPendencia;
      },
    );
    store.goTo(store.totalDePassos - 1);
    fixture.detectChanges();

    await fixture.componentInstance.nextOrPublish();

    expect(definirCronogramaFases).toHaveBeenCalledOnce();
    const [, fases] = definirCronogramaFases.mock.calls[0] as unknown as [
      string,
      readonly FaseCronogramaInput[],
    ];
    expect(fases.map((fase) => fase.regraDeHomologacao)).toStrictEqual([
      REGRA_DE_HOMOLOGACAO_DO_SERVIDOR,
    ]);
    expect(publicacao).toHaveBeenCalledOnce();
    expect(definirCronogramaFases.mock.invocationCallOrder[0]).toBeLessThan(
      publicacao.mock.invocationCallOrder[0],
    );
  });
});
