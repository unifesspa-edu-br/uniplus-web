import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import {
  AreaPesoAreaEnemDto,
  CONFIGURACAO_BASE_PATH,
  GrupoAreaEnemDto,
  PesoAreaEnemDto,
} from '@uniplus/shared-data/configuracao';
import { expect } from 'vitest';
import { mensagemDeErroDoControle } from '../../shared/formulario';
import { CriacaoDeResolucao } from './criacao-de-resolucao';
import { EdicaoDosParametros } from './edicao-dos-parametros';
import { GravacaoDosPesosEnem } from './gravacao-dos-pesos-enem';
import { RemocaoDeResolucao } from './remocao-de-resolucao';
import { mensagemDoCampoNumerico } from './pesos-enem-campo-numerico';
import type { AreaForm, PesoEdicaoGrupoForm } from './pesos-enem-form';
import type { CampoDaArea } from './pesos-enem-limites';
import { PesosEnemPage } from './pesos-enem.page';
import { PesosEnemStore } from './pesos-enem.store';

export const BASE = 'http://localhost:5000';
export const LIST_URL = `${BASE}/api/configuracao/pesos-area-enem`;
export const AREAS_URL = `${BASE}/api/configuracao/pesos-area-enem/areas`;
export const ESCRITA = `${BASE}/api/configuracao/admin/pesos-area-enem`;
export const GRUPOS_URL = `${BASE}/api/configuracao/vocabularios/grupos-area-enem`;

/** As cinco áreas como a API as devolve: código, rótulo oficial e ordem canônica. */
export const AREAS: readonly AreaPesoAreaEnemDto[] = [
  { codigo: 'REDACAO', rotulo: 'Redação' },
  { codigo: 'CIENCIAS_DA_NATUREZA', rotulo: 'Ciências da Natureza e suas Tecnologias' },
  { codigo: 'CIENCIAS_HUMANAS', rotulo: 'Ciências Humanas e suas Tecnologias' },
  { codigo: 'LINGUAGENS', rotulo: 'Linguagens e suas Tecnologias' },
  { codigo: 'MATEMATICA', rotulo: 'Matemática e suas Tecnologias' },
];

/** Os grupos de área do ENEM como a API os devolve: código, rótulo e ordem. */
export const GRUPOS: readonly GrupoAreaEnemDto[] = [
  { codigo: 'TECNOLOGICA', rotulo: 'Tecnológica' },
  { codigo: 'HUMANISTICA_I', rotulo: 'Humanística I' },
  { codigo: 'HUMANISTICA_II', rotulo: 'Humanística II' },
  { codigo: 'SAUDE_E_BIOLOGICAS', rotulo: 'Saúde e Biológicas' },
];

export function grupo(codigo: string): GrupoAreaEnemDto {
  const encontrado = GRUPOS.find((g) => g.codigo === codigo);
  if (!encontrado) throw new Error(`grupo ${codigo} ausente dos fixtures`);
  return encontrado;
}

/** Pesos padrão por código; a Redação tem corte 400, as demais não têm corte. */
const PESOS_PADRAO: Readonly<Record<string, number>> = {
  REDACAO: 1,
  CIENCIAS_DA_NATUREZA: 1.5,
  CIENCIAS_HUMANAS: 1,
  LINGUAGENS: 1,
  MATEMATICA: 2.5,
};

export function linha(
  overrides: Partial<PesoAreaEnemDto> & Pick<PesoAreaEnemDto, 'id' | 'resolucao' | 'grupoCurso'>,
): PesoAreaEnemDto {
  return {
    areas: AREAS.map((area) => ({
      codigo: area.codigo,
      rotulo: area.rotulo,
      peso: PESOS_PADRAO[area.codigo] ?? 1,
      corte: area.codigo === 'REDACAO' ? 400 : null,
    })),
    baseLegal: 'Res. 805/2024 Anexo I',
    criadoEm: '2026-06-24T12:00:00Z',
    ...overrides,
  };
}

/** Peso de uma área numa linha de `registros`. */
export function pesoDe(
  dto: PesoAreaEnemDto | undefined,
  codigo: string,
): number | string | undefined {
  return dto?.areas.find((area) => area.codigo === codigo)?.peso;
}

export const RES_805 = 'Res. 805/2024';
export const RES_750 = 'Res. 750/2022';

export const linhas805: readonly PesoAreaEnemDto[] = [
  linha({
    id: '01960000-0000-7000-0000-0000000000a1',
    resolucao: RES_805,
    grupoCurso: grupo('TECNOLOGICA'),
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000a2',
    resolucao: RES_805,
    grupoCurso: grupo('HUMANISTICA_I'),
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000a3',
    resolucao: RES_805,
    grupoCurso: grupo('HUMANISTICA_II'),
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000a4',
    resolucao: RES_805,
    grupoCurso: grupo('SAUDE_E_BIOLOGICAS'),
  }),
];

export const linhas750: readonly PesoAreaEnemDto[] = [
  linha({
    id: '01960000-0000-7000-0000-0000000000b1',
    resolucao: RES_750,
    grupoCurso: grupo('TECNOLOGICA'),
    criadoEm: '2025-01-10T12:00:00Z',
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000b2',
    resolucao: RES_750,
    grupoCurso: grupo('HUMANISTICA_I'),
    criadoEm: '2025-01-10T12:00:00Z',
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000b3',
    resolucao: RES_750,
    grupoCurso: grupo('HUMANISTICA_II'),
    criadoEm: '2025-01-10T12:00:00Z',
  }),
  linha({
    id: '01960000-0000-7000-0000-0000000000b4',
    resolucao: RES_750,
    grupoCurso: grupo('SAUDE_E_BIOLOGICAS'),
    criadoEm: '2025-01-10T12:00:00Z',
  }),
];

export function problem(
  status: number,
  code: string,
  title: string,
  errors?: readonly { field: string; code: string; message: string }[],
): string {
  return JSON.stringify({
    type: `https://unifesspa-edu-br.github.io/uniplus-developers/erros/${code}`,
    title,
    status,
    code,
    traceId: 'test-trace',
    errors,
  });
}

export const ERRO_500 = {
  status: 500,
  statusText: 'Internal Server Error',
  headers: { 'content-type': 'application/problem+json' },
};

export const SEM_CORPO = { status: 204, statusText: 'No Content' } as const;
export const CRIADO = { status: 201, statusText: 'Created' } as const;

export function recusa(status: number, code: string, errors?: Parameters<typeof problem>[3]) {
  return [
    problem(status, code, 'Falha', errors),
    { status, statusText: 'Erro', headers: { 'content-type': 'application/problem+json' } },
  ] as const;
}

export function recusa422(
  req: TestRequest | undefined,
  errors: readonly { field: string; code: string; message: string }[],
): void {
  req?.flush(
    problem(422, errors[0]?.code ?? 'uniplus.configuracao.peso_area_enem.regra', 'Recusa', errors),
    {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'content-type': 'application/problem+json' },
    },
  );
}

/** Controles de uma área (peso, corte) dentro de um grupo do formulário. */
export function areaDo(
  grupo:
    | { controls: { areas: { controls: readonly { controls: { codigo: { value: string } } }[] } } }
    | undefined,
  codigo: string,
): FormGroup<AreaForm> {
  const area = grupo?.controls.areas.controls.find((a) => a.controls.codigo.value === codigo);
  if (!area) throw new Error(`área ${codigo} ausente do formulário`);
  return area as unknown as FormGroup<AreaForm>;
}

/** A mensagem que a tela mostra para o campo numérico de uma área. */
export function erroDaArea(area: FormGroup<AreaForm>, campo: CampoDaArea): string | null {
  return mensagemDoCampoNumerico(area.controls[campo], campo);
}

/** Simula o navegador marcando o texto digitado como não numérico (`badInput`): o `value`
 *  fica vazio e o evento `input` dispara, como no navegador real. */
export function digitarNumeroInvalido(input: HTMLInputElement): void {
  Object.defineProperty(input, 'validity', {
    configurable: true,
    value: { ...input.validity, badInput: true, valid: false },
  });
  input.value = '';
  input.dispatchEvent(new Event('input'));
}

/** Texto inválido digitado e o operador sai do campo: quando o erro é acusado. */
export function digitarNumeroInvalidoESair(input: HTMLInputElement): void {
  digitarNumeroInvalido(input);
  input.dispatchEvent(new FocusEvent('blur'));
}

export type FormularioDaEdicao = NonNullable<ReturnType<EdicaoDosParametros['form']>>;
export type GrupoEmEdicao = FormGroup<PesoEdicaoGrupoForm>;

/** A tela montada para o teste: o componente e as classes que a página provê. */
/** Indisponível pelo atributo `disabled` (ações da linha) ou por `aria-disabled` (botões que ficam focáveis). */
export function indisponivel(botao: HTMLElement): boolean {
  return botao.matches(':disabled') || botao.getAttribute('aria-disabled') === 'true';
}

export class PaginaDeTeste {
  readonly fixture: ComponentFixture<PesosEnemPage>;
  readonly controller: HttpTestingController;
  readonly appRef: ApplicationRef;

  constructor() {
    TestBed.configureTestingModule({
      imports: [PesosEnemPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    this.fixture = TestBed.createComponent(PesosEnemPage);
    this.controller = TestBed.inject(HttpTestingController);
    this.appRef = TestBed.inject(ApplicationRef);
  }

  get raiz(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  get store(): PesosEnemStore {
    return this.fixture.debugElement.injector.get(PesosEnemStore);
  }

  get gravacao(): GravacaoDosPesosEnem {
    return this.fixture.debugElement.injector.get(GravacaoDosPesosEnem);
  }

  get edicao(): EdicaoDosParametros {
    return this.fixture.debugElement.injector.get(EdicaoDosParametros);
  }

  get criacao(): CriacaoDeResolucao {
    return this.fixture.debugElement.injector.get(CriacaoDeResolucao);
  }

  get remocao(): RemocaoDeResolucao {
    return this.fixture.debugElement.injector.get(RemocaoDeResolucao);
  }

  verificar(): void {
    this.controller.verify();
  }

  async propagate(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
  }

  expectAreas(): TestRequest {
    const req = this.controller.expectOne((r) => r.url === AREAS_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('area-peso-area-enem', 1));
    return req;
  }

  expectGrupos(): TestRequest {
    const req = this.controller.expectOne((r) => r.url === GRUPOS_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('codigo-grupo-area-enem', 1),
    );
    return req;
  }

  expectListagem(): TestRequest {
    const req = this.controller.expectOne((r) => r.url === LIST_URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('peso-area-enem', 1));
    return req;
  }

  /** Carrega a página com as listas de áreas e de grupos e uma única página de resultados (sem Link de próxima página). */
  async carregarUmaPagina(
    dados: readonly PesoAreaEnemDto[],
    areas: readonly AreaPesoAreaEnemDto[] = AREAS,
    grupos: readonly GrupoAreaEnemDto[] = GRUPOS,
  ): Promise<void> {
    this.fixture.detectChanges();
    this.expectAreas().flush([...areas]);
    this.expectGrupos().flush([...grupos]);
    this.expectListagem().flush([...dados]);
    await this.propagate();
    this.fixture.detectChanges();
  }

  /** Propaga o ciclo de detecção e atualiza a view, como a pessoa veria a tela. */
  async propagar(): Promise<void> {
    await this.propagate();
    this.fixture.detectChanges();
  }

  elemento<T extends HTMLElement>(seletor: string): T {
    const encontrado = this.raiz.querySelector<T>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  }

  /** O primeiro botão com este texto. */
  botao(texto: string): HTMLButtonElement {
    const botao = [...this.raiz.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidato) => candidato.textContent?.trim() === texto,
    );
    expect(botao, texto).toBeDefined();
    return botao as HTMLButtonElement;
  }

  /** Clica de verdade: o foco vai ao botão antes, como no navegador. */
  async acionar(botao: HTMLElement): Promise<void> {
    botao.focus();
    botao.click();
    await this.propagar();
  }

  preencher(seletor: string, valor: string): void {
    const campo = this.elemento<HTMLInputElement>(seletor);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  /** Responde à releitura da lista com estas linhas. */
  async recarregarCom(dados: readonly PesoAreaEnemDto[]): Promise<void> {
    await this.propagar();
    this.expectListagem().flush([...dados]);
    await this.propagar();
  }

  /** Abre o cadastro, preenche o mínimo e devolve o botão de enviar. */
  async abrirCadastro(): Promise<void> {
    await this.acionar(this.botao('Cadastrar nova resolução'));
    this.preencher('[formcontrolname="resolucao"]', 'Res. 900/2026');
    this.preencher('[formcontrolname="baseLegalGlobal"]', 'Res. 900/2026 Anexo I');
    await this.propagar();
  }

  /** Envia o cadastro com o foco no botão e devolve os quatro POST. */
  async enviarCadastro(): Promise<TestRequest[]> {
    await this.acionar(this.elemento('button[form="cfg-pesos-enem-form"]'));
    return this.controller.match((r) => r.url === ESCRITA && r.method === 'POST');
  }

  async abrirEdicao(): Promise<void> {
    await this.acionar(this.elemento(`#pe-editar-${'res-805-2024'}`));
  }

  /** Salva a edição com o foco no botão e devolve os quatro PUT. */
  async enviarEdicao(): Promise<TestRequest[]> {
    await this.acionar(this.botao('Salvar'));
    return this.controller.match((r) => r.url.startsWith(`${ESCRITA}/`) && r.method === 'PUT');
  }

  inputDaEdicao(campo: 'peso' | 'corte', grupo: number, area: number): HTMLInputElement {
    const input = this.raiz.querySelector<HTMLInputElement>(
      `#pe-res-805-2024-g${grupo}-a${area}-${campo}`,
    );
    if (!input) throw new Error(`input de ${campo} (g${grupo}, a${area}) ausente`);
    return input;
  }

  erroDoCampoLote(nome: 'resolucao' | 'baseLegalGlobal'): string | null {
    return mensagemDeErroDoControle(this.criacao.form.controls[nome]);
  }

  erroDoCampoGrupo(indice: number, nome: 'baseLegal'): string | null {
    return mensagemDeErroDoControle(this.criacao.form.controls.grupos.at(indice).controls[nome]);
  }
}
