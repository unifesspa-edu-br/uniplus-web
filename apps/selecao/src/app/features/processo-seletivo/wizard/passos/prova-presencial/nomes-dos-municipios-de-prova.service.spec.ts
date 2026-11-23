import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { apiFailure, apiOk } from '@uniplus/shared-core/http';
import {
  EscolhaComExplicacaoComponent,
  type LeituraDeMunicipio,
  LEITURA_DE_MUNICIPIO_POR_CODIGO,
} from '@uniplus/shared-ui/components';
import { of, Subject, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { provePassoDoWizard } from '../../passo-do-wizard';
import { NumeracaoDasRespostasRecusadas } from '../../shared/recusas/numeracao-das-respostas-recusadas';
import { RecusasDaPublicacao } from '../../shared/recusas/recusas-da-publicacao.service';
import { RecusasDaPublicacaoNaProvaPresencial } from './recusas-da-publicacao-na-prova-presencial.service';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { dtoComCronograma } from '../../shared/hidratacao.testing';
import { GravacaoDaProvaPresencialService } from './gravacao-da-prova-presencial.service';
import { recusasDaProvaPresencial } from './recusas-da-prova-presencial';
import { NomesDosMunicipiosDeProva } from './nomes-dos-municipios-de-prova.service';
import { SITUACAO_RASCUNHO } from './prova-presencial.testing';
import { ProvaPresencialPassoComponent } from './prova-presencial.component';

const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };
const SEM_NOME = { ...MARABA, nome: null };
const CODIGO_SEM_NOME = 'município de código 1504208 (PA)';
const headers = new HttpHeaders();

function preparar(ler: LeituraDeMunicipio) {
  TestBed.configureTestingModule({
    imports: [ProvaPresencialPassoComponent],
    providers: [
      provideHttpClient(),
      ProcessoSeletivoStore,
      {
        provide: GravacaoDaProvaPresencialService,
        useValue: {
          aviso: signal(null),
          gravadaNoServidor: signal(null),
          recusasDaGravacao: signal(recusasDaProvaPresencial([], [])),
        },
      },
      NumeracaoDasRespostasRecusadas,
      RecusasDaPublicacao,
      RecusasDaPublicacaoNaProvaPresencial,
      { provide: GEO_BASE_PATH, useValue: '/geo' },
    ],
  });
  TestBed.overrideComponent(ProvaPresencialPassoComponent, {
    set: {
      providers: [
        provePassoDoWizard(ProvaPresencialPassoComponent),
        NomesDosMunicipiosDeProva,
        { provide: LEITURA_DE_MUNICIPIO_POR_CODIGO, useValue: ler },
      ],
    },
  });
  const fixture = TestBed.createComponent(ProvaPresencialPassoComponent);
  const store = TestBed.inject(ProcessoSeletivoStore);
  store.remoteSnapshot.set(
    dtoComCronograma({
      situacao: SITUACAO_RASCUNHO,
      provaPresencial: {
        temProvaPresencial: true,
        municipios: [SEM_NOME],
      },
    }),
  );
  store.patchObjectSection('provaPresencial', { temProvaPresencial: true, municipios: [SEM_NOME] });
  fixture.detectChanges();
  return { fixture, store };
}

type TelaDaProva = ComponentFixture<ProvaPresencialPassoComponent>;

const textoDaTela = (fixture: TelaDaProva): string => fixture.nativeElement.textContent;

const respostaNaoEncontrado = () =>
  apiFailure(
    {
      type: 'about:blank',
      title: 'Não encontrado',
      status: 404,
      code: 'nao-encontrado',
      traceId: 'teste',
    },
    404,
    headers,
  );

function prepararComNomeResolvido() {
  const resposta = new Subject<ReturnType<typeof apiOk<typeof MARABA>>>();
  const ler = vi.fn(() => resposta);
  const preparado = preparar(ler);
  expect(textoDaTela(preparado.fixture)).toContain(CODIGO_SEM_NOME);
  resposta.next(apiOk(MARABA, 200, headers));
  preparado.fixture.detectChanges();
  return { ...preparado, ler };
}

function escolherSemProvaPresencial(fixture: TelaDaProva): void {
  fixture.debugElement
    .query(By.directive(EscolhaComExplicacaoComponent))
    .componentInstance.escolhido.emit('sem');
  fixture.detectChanges();
}

function reaplicarMunicipioSemNome(fixture: TelaDaProva, store: ProcessoSeletivoStore): void {
  store.patchObjectSection('provaPresencial', { temProvaPresencial: true, municipios: [SEM_NOME] });
  fixture.detectChanges();
}

describe('nomes dos municípios de prova', () => {
  it('resolve a lista e o botão uma vez por código', () => {
    const { fixture, store, ler } = prepararComNomeResolvido();
    expect(textoDaTela(fixture)).toContain('Marabá (PA)');
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Remover Marabá (PA)"]'),
    ).not.toBeNull();
    reaplicarMunicipioSemNome(fixture, store);
    expect(ler).toHaveBeenCalledOnce();
  });

  it('resolve o aviso e a confirmação uma vez por código', () => {
    const { fixture, store, ler } = prepararComNomeResolvido();
    escolherSemProvaPresencial(fixture);
    expect(textoDaTela(fixture)).toContain(
      'O município de prova (Marabá (PA)) será removido ao salvar.',
    );
    expect(fixture.componentInstance.confirmacaoDeGravacao()?.itens[0].valor).toBe('Marabá (PA)');
    reaplicarMunicipioSemNome(fixture, store);
    expect(ler).toHaveBeenCalledOnce();
  });

  it('mantém o rótulo de código quando o Geo falha, sem repetir a leitura', () => {
    const ler = vi.fn(() => throwError(() => new Error('falha')));
    const { fixture } = preparar(ler);
    fixture.detectChanges();
    expect(textoDaTela(fixture)).toContain(CODIGO_SEM_NOME);
    expect(ler).toHaveBeenCalledOnce();
  });

  it('mantém o rótulo de código quando o município não existe', () => {
    const ler = vi.fn(() => of(respostaNaoEncontrado()));
    const { fixture } = preparar(ler);
    fixture.detectChanges();
    expect(textoDaTela(fixture)).toContain(CODIGO_SEM_NOME);
    expect(ler).toHaveBeenCalledOnce();
  });
});
