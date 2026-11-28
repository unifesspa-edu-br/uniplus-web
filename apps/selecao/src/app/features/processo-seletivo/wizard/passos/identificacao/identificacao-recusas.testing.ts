import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import { ORGANIZACAO_BASE_PATH } from '@uniplus/shared-data/organizacao';
import { OrigemCandidatosCodigo, SELECAO_BASE_PATH } from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import { GravacaoDoProcesso } from '../../shared/gravacao/gravacao-do-processo';
import { tick } from './identificacao-identificador.testing';
import { IdentificacaoPassoComponent } from './identificacao.component';
import { GravacaoDaIdentificacao } from './servicos/gravacao-da-identificacao.service';

export const BASE = 'http://localhost:5000';
export const URL_DA_CRIACAO = `${BASE}/api/selecao/processos-seletivos`;
export const TIPO_ID = '01960000-0000-7000-0000-0000000005bb';
export const UNIDADE_ID = '01960000-0000-7000-0000-0000000005cc';
export const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' } as const;
export const NOME_DE_MARLENE = 'Seleção da Marlene 2027';
export const IDENTIFICADOR_DE_MARLENE = 'selecao-da-marlene-2027';
export const EM_USO = 'uniplus.selecao.processo_seletivo.identificador_legivel_em_uso';

export const MENSAGEM_DO_NOME = 'O nome do processo seletivo é obrigatório.';
export const MENSAGEM_DA_ORIGEM = 'A origem dos candidatos é obrigatória.';
export const MENSAGEM_DO_IDENTIFICADOR = 'O identificador legível é obrigatório.';
export const MENSAGEM_DA_UNIDADE = 'A unidade administradora deve existir no cadastro de unidades.';
export const MENSAGEM_DA_LOCALIDADE = 'A localidade informada não existe.';
export const MENSAGEM_DO_TIPO = 'O tipo de processo informado não existe.';

export interface Causa {
  readonly field?: string;
  readonly code: string;
  readonly message: string;
}

export const NOME: Causa = {
  field: 'nome',
  code: 'validacao.obrigatorio',
  message: MENSAGEM_DO_NOME,
};
export const ORIGEM: Causa = {
  field: 'origemCandidatos',
  code: 'validacao.obrigatorio',
  message: MENSAGEM_DA_ORIGEM,
};
export const IDENTIFICADOR: Causa = {
  field: 'identificadorLegivel',
  code: 'validacao.obrigatorio',
  message: MENSAGEM_DO_IDENTIFICADOR,
};
export const UNIDADE: Causa = {
  field: 'unidadeAdministradoraOrigemId',
  code: 'validacao.regra',
  message: MENSAGEM_DA_UNIDADE,
};
export const LOCALIDADE: Causa = {
  field: 'localidadeCodigoIbge',
  code: 'validacao.regra',
  message: MENSAGEM_DA_LOCALIDADE,
};
export const TIPO: Causa = {
  field: 'tipoProcessoOrigemId',
  code: 'validacao.regra',
  message: MENSAGEM_DO_TIPO,
};

export const BASE_DAS_PAGINAS = 'https://erros.exemplo.unifesspa.edu.br/erros/';

function problemaDaRecusa(errors: readonly Causa[], titulo: string, type: string) {
  const status = 0;
  return {
    type,
    title: titulo,
    status,
    code: errors[0]?.code ?? EM_USO,
    traceId: 'trace-1',
    errors,
  };
}

export function recusa(
  status: number,
  errors: readonly Causa[],
  titulo = 'Falha de validação',
  type = 'about:blank',
) {
  return {
    body: { ...problemaDaRecusa(errors, titulo, type), status },
    opts: {
      status,
      statusText: titulo,
      headers: { 'Content-Type': 'application/problem+json' },
    },
  };
}

export interface CenarioDeRecusas {
  readonly fixture: ComponentFixture<IdentificacaoPassoComponent>;
  readonly componente: IdentificacaoPassoComponent;
  readonly gravacao: GravacaoDaIdentificacao;
  readonly store: ProcessoSeletivoStore;
  readonly controller: HttpTestingController;
  readonly host: HTMLElement;
  /** Tenta criar o processo e responde com a recusa; devolve o resultado do passo. */
  criarRecusado(
    status: number,
    errors: readonly Causa[],
    titulo?: string,
    type?: string,
  ): ReturnType<IdentificacaoPassoComponent['persistir']>;
  /** O elemento de id dado, dentro da tela. */
  campo(id: string): HTMLElement;
  /** A mensagem de cada recusa do campo, sem o código nem o link. */
  recusaDoCampo(id: string): string;
  codigosDoCampo(id: string): string[];
  paginasDoCampo(id: string): string[];
  ligadoAoCampo(id: string): boolean;
}

async function configurarModulo(): Promise<void> {
  await TestBed.configureTestingModule({
    imports: [IdentificacaoPassoComponent],
    providers: [
      ProcessoSeletivoStore,
      CadastroInicial,
      GravacaoDoProcesso,
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      { provide: SELECAO_BASE_PATH, useValue: BASE },
      { provide: ORGANIZACAO_BASE_PATH, useValue: BASE },
      { provide: GEO_BASE_PATH, useValue: BASE },
    ],
  }).compileComponents();
}

function preencherOProcesso(store: ProcessoSeletivoStore): void {
  store.patchObjectSection('tipoProcesso', { selected: TIPO_ID, rotulo: 'Vestibular' });
  store.patchObjectSection('identificacao', {
    nome: NOME_DE_MARLENE,
    unidadeAdministradoraId: UNIDADE_ID,
    origemCandidatos: OrigemCandidatosCodigo.INSCRICAO_PROPRIA,
    localidade: MARABA,
    identificadorLegivel: IDENTIFICADOR_DE_MARLENE,
  });
}

async function abrirTela() {
  await configurarModulo();
  const fixture = TestBed.createComponent(IdentificacaoPassoComponent);
  const store = TestBed.inject(ProcessoSeletivoStore);
  const controller = TestBed.inject(HttpTestingController);
  controller.expectOne(`${BASE}/api/organizacao/unidades?limit=100`).flush([]);
  preencherOProcesso(store);
  fixture.detectChanges();
  return { fixture, store, controller };
}

function leitorDaTela(host: HTMLElement) {
  const campo = (id: string): HTMLElement => host.querySelector(`#${id}`) as HTMLElement;
  const textos = (id: string, seletor: string, atributo?: string): string[] =>
    [...campo(`${id}-erro`).querySelectorAll(seletor)].map(
      (no) => (atributo ? no.getAttribute(atributo) : no.textContent)?.trim() ?? '',
    );
  return {
    campo,
    recusaDoCampo: (id: string) => textos(id, '.field__error > span:first-child').join(' '),
    codigosDoCampo: (id: string) => textos(id, '.field__error code'),
    paginasDoCampo: (id: string) => textos(id, 'a', 'href'),
    ligadoAoCampo: (id: string) =>
      (campo(id).getAttribute('aria-describedby') ?? '').split(' ').includes(`${id}-erro`),
  };
}

function criadorDeRecusas(
  fixture: ComponentFixture<IdentificacaoPassoComponent>,
  controller: HttpTestingController,
): CenarioDeRecusas['criarRecusado'] {
  return async (status, errors, titulo, type) => {
    const resultado = fixture.componentInstance.persistir();
    const { body, opts } = recusa(status, errors, titulo, type);
    controller.expectOne(URL_DA_CRIACAO).flush(body, opts);
    await tick();
    const validacao = await resultado;
    fixture.detectChanges();
    await fixture.whenStable();
    return validacao;
  };
}

/** A tela da identificação com os campos preenchidos, pronta para a criação ser recusada. */
export async function montarCenarioDeRecusas(): Promise<CenarioDeRecusas> {
  const { fixture, store, controller } = await abrirTela();
  const host = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    componente: fixture.componentInstance,
    gravacao: fixture.debugElement.injector.get(GravacaoDaIdentificacao),
    store,
    controller,
    host,
    criarRecusado: criadorDeRecusas(fixture, controller),
    ...leitorDaTela(host),
  };
}
