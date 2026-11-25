import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { PUBLICACOES_BASE_PATH } from '@uniplus/shared-data/publicacoes';
import {
  SELECAO_BASE_PATH,
  SituacaoDoProcessoSeletivoCodigo,
  type FormularioDto,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { CATALOGOS_DO_CRONOGRAMA } from '../cronograma/catalogos/catalogos-do-cronograma';
import { FormularioPassoComponent } from './formulario.component';
import { conteudoDoFormulario } from './formulario-do-processo';
import { AplicacaoDeModelo } from './servicos/aplicacao-de-modelo.service';
import {
  BASE,
  FASE_HABILITACAO,
  FASE_INSCRICAO,
  GRAVADO,
  HABILITACAO_GRAVADA,
  MODELOS,
  PCD_NO_CATALOGO,
  PROCESSO,
  PROCESSO_ID,
  ROTA_MODELOS,
} from './formulario-gravado.testing';

export {
  BASE,
  PROCESSO_ID,
  ROTA_PROCESSO,
  ROTA_INSCRICAO,
  ROTA_HABILITACAO,
  ROTA_APLICACAO,
  ROTA_MODELOS,
  PROBLEM_JSON,
  CONGELADOS_DA_INSCRICAO,
  FASE_INSCRICAO,
  FASE_HABILITACAO,
  campo,
  etapa,
  GRAVADO,
  HABILITACAO_GRAVADA,
  PROCESSO,
  PCD_NO_CATALOGO,
  modelo,
  MODELOS,
  relato,
  INSCRICAO_COPIADA,
  PROCESSO_COM_DERIVACOES,
} from './formulario-gravado.testing';

/** Deixa a cadeia de `await` da gravação avançar antes da próxima expectativa. */
export const proximoPasso = () => new Promise((resolve) => setTimeout(resolve, 0));

/** O passo montado e o que os cenários consultam e conduzem nele. */
export class ContextoDoPasso {
  readonly host: HTMLElement;

  constructor(
    readonly fixture: ComponentFixture<FormularioPassoComponent>,
    readonly store: ProcessoSeletivoStore,
    readonly controller: HttpTestingController,
  ) {
    this.host = fixture.nativeElement as HTMLElement;
  }

  readonly servicoDeModelos = (): AplicacaoDeModelo =>
    this.fixture.debugElement.injector.get(AplicacaoDeModelo);

  readonly valor = (rotulo: string): readonly (string | undefined)[] =>
    Array.from(this.host.querySelectorAll('dl'))
      .filter((dl) => dl.querySelector('dt')?.textContent?.trim() === rotulo)
      .map((dl) => dl.querySelector('dd')?.textContent?.trim());

  readonly declararDesempate = (regraCodigo: string): void => {
    this.store.patchSection('desempate', [
      {
        regraCodigo,
        regraVersao: 'v1',
        etapaRef: '',
        idadeMinima: '',
        fato: '',
        operador: '',
        valor: '',
        areas: [],
      },
    ]);
  };

  /** O processo como a hidratação o deixa: o gravado é o que a simulação abre. */
  readonly comProcessoLido = (
    formularios: readonly FormularioDto[] = PROCESSO.formularios,
  ): void => {
    this.store.remoteSnapshot.set({
      ...PROCESSO,
      formularios,
      id: PROCESSO_ID,
      situacao: {
        codigo: SituacaoDoProcessoSeletivoCodigo.RASCUNHO,
        rotulo: SituacaoDoProcessoSeletivoCodigo.RASCUNHO,
      },
    } as never);
    this.fixture.detectChanges();
  };

  /** O processo com a habilitação como segunda aba do formulário, depois da inscrição. */
  readonly comHabilitacao = (): void => {
    const { cronograma } = this.store.draft();
    this.store.patchSection('cronograma', {
      ...cronograma,
      fases: [FASE_INSCRICAO, FASE_HABILITACAO],
    });
    const conteudo = conteudoDoFormulario(HABILITACAO_GRAVADA);
    this.store.patchObjectSection('formulario', {
      outrasFinalidades: [{ finalidade: 'HABILITACAO', faseCodigo: '', conteudo }],
    });
    this.fixture.detectChanges();
  };

  /** O tipo do processo conhecido e a lista de modelos atendida. */
  readonly comModelosCarregados = (): void => {
    this.store.patchObjectSection('tipoProcesso', { codigo: 'MEDICINA' });
    this.fixture.detectChanges();
    this.controller.expectOne((r) => r.url === ROTA_MODELOS).flush(MODELOS);
    this.fixture.detectChanges();
  };

  readonly escolherEAplicar = (finalidade: string, modeloId: string): Promise<void> => {
    this.servicoDeModelos().escolher(finalidade, modeloId);
    this.servicoDeModelos().pedir(finalidade);
    return this.fixture.componentInstance.confirmarAplicacao();
  };
}

const PROVEDORES_DO_PASSO = [
  provideRouter([]),
  ProcessoSeletivoStore,
  CadastroInicial,
  GravacaoDoProcesso,
  ...CATALOGOS_DO_CRONOGRAMA,
  provideHttpClient(withInterceptors([apiResultInterceptor])),
  provideHttpClientTesting(),
  { provide: SELECAO_BASE_PATH, useValue: BASE },
  { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
  { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
  { provide: PUBLICACOES_BASE_PATH, useValue: BASE },
  { provide: GEO_BASE_PATH, useValue: BASE },
];

async function configurarModulo(): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [FormularioPassoComponent],
    providers: PROVEDORES_DO_PASSO,
  }).compileComponents();
}

function prepararProcesso(store: ProcessoSeletivoStore): void {
  store.processoSeletivoId.set(PROCESSO_ID);
  store.patchSection('cronograma', { ...store.draft().cronograma, fases: [FASE_INSCRICAO] });
  store.patchObjectSection('formulario', {
    conteudo: conteudoDoFormulario(GRAVADO),
    referenciaTemporal: { tipo: 'DATA_ESPECIFICA', data: '2027-01-15', faseCodigo: '' },
  });
}

function atenderCatalogos(controller: HttpTestingController): void {
  for (const requisicao of controller.match(() => true)) {
    requisicao.flush(requisicao.request.url.includes('fatos-candidato') ? [PCD_NO_CATALOGO] : []);
  }
}

async function montarPasso(): Promise<ContextoDoPasso> {
  await configurarModulo();
  const store = TestBed.inject(ProcessoSeletivoStore);
  const controller = TestBed.inject(HttpTestingController);
  prepararProcesso(store);
  const fixture = TestBed.createComponent(FormularioPassoComponent);
  fixture.detectChanges();
  atenderCatalogos(controller);
  fixture.detectChanges();
  return new ContextoDoPasso(fixture, store, controller);
}

/**
 * Registra, no `describe` que a chama, a montagem do passo antes de cada caso e a conferência de
 * que nenhuma requisição ficou sem resposta depois dele. `aoMontar` recebe o passo montado.
 */
export function usarPasso(aoMontar: (contexto: ContextoDoPasso) => void): void {
  let atual: ContextoDoPasso;
  beforeEach(async () => {
    atual = await montarPasso();
    aoMontar(atual);
  });
  afterEach(() => atual.controller.verify());
}
