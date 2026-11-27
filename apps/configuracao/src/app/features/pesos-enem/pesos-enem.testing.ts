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
import {
  AREAS,
  AREAS_URL,
  BASE,
  ESCRITA,
  GRUPOS,
  GRUPOS_URL,
  LIST_URL,
  RES_805,
  linhas805,
} from './pesos-enem-exemplos.testing';
import {
  ERRO_500,
  flushProblema,
  problem,
  responderCriacoes,
} from './pesos-enem-respostas.testing';
import { CriacaoDeResolucao } from './criacao-de-resolucao';
import { EdicaoDosParametros } from './edicao-dos-parametros';
import { GravacaoDosPesosEnem } from './gravacao-dos-pesos-enem';
import { RemocaoDeResolucao } from './remocao-de-resolucao';
import { mensagemDoCampoNumerico } from './pesos-enem-campo-numerico';
import type { AreaForm, PesoEdicaoGrupoForm } from './pesos-enem-form';
import type { CampoDaArea } from './pesos-enem-limites';
import { PesosEnemPage } from './pesos-enem.page';
import { PesosEnemStore } from './pesos-enem.store';

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
export interface RequisicoesDaEdicao {
  readonly primeira: TestRequest;
  readonly demais: readonly TestRequest[];
}
export type GrupoEmEdicao = FormGroup<PesoEdicaoGrupoForm>;

/** Indisponível pelo atributo `disabled` (ações da linha) ou por `aria-disabled` (botões que ficam focáveis). */
export function indisponivel(botao: HTMLElement): boolean {
  return botao.matches(':disabled') || botao.getAttribute('aria-disabled') === 'true';
}

/** A tela montada para o teste: o componente e as classes que a página provê. */
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

  get elementoDaPagina(): HTMLElement {
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

  async atualizarAplicacao(): Promise<void> {
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
    await this.atualizarAplicacao();
    this.fixture.detectChanges();
  }

  /** Propaga o ciclo de detecção e atualiza a view, como a pessoa veria a tela. */
  async propagar(): Promise<void> {
    await this.atualizarAplicacao();
    this.fixture.detectChanges();
  }

  elemento<T extends HTMLElement>(seletor: string): T {
    const encontrado = this.elementoDaPagina.querySelector<T>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  }

  /** O primeiro botão com este texto. */
  botao(texto: string): HTMLButtonElement {
    const botao = [...this.elementoDaPagina.querySelectorAll<HTMLButtonElement>('button')].find(
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

  formularioDaEdicao(): FormularioDaEdicao {
    const formulario = this.edicao.form();
    if (formulario === null) throw new Error('a edição está fechada: não há formulário');
    return formulario;
  }

  /** Abre a edição de RES_805 e salva pelo modelo; devolve o primeiro PUT e os demais. */
  async enviarEdicaoPeloModelo(): Promise<RequisicoesDaEdicao> {
    this.edicao.pedirEdicao(RES_805);
    await this.atualizarAplicacao();
    this.edicao.salvar();
    await this.atualizarAplicacao();
    const [primeira, ...demais] = linhas805.map((linha) =>
      this.controller.expectOne(`${ESCRITA}/${linha.id}`),
    );
    if (primeira === undefined) throw new Error('a resolução de exemplo não tem linhas');
    return { primeira, demais };
  }

  preencherResolucaoDoCadastro(): void {
    this.criacao.form.patchValue({
      resolucao: 'Res. 900/2026',
      baseLegalGlobal: 'Res. 900/2026 Anexo I',
    });
  }

  async abrirCadastroPreenchido(): Promise<void> {
    this.criacao.abrir();
    this.preencherResolucaoDoCadastro();
    await this.atualizarAplicacao();
  }

  /** Cria com o primeiro POST em erro interno; devolve a chave de idempotência dele. */
  async criarComFalhaTransitoriaNoPrimeiro(): Promise<string | null> {
    await this.abrirCadastroPreenchido();
    const [primeira, ...demais] = await this.enviarCriacaoPeloModelo();
    expect(demais).toHaveLength(3);
    const chave = primeira?.request.headers.get('Idempotency-Key') ?? null;
    flushProblema(primeira, ERRO_500, problem(500, 'uniplus.internal.unexpected', 'Erro interno'));
    responderCriacoes(demais);
    await this.atualizarAplicacao();
    return chave;
  }

  conferirCamposDoFormularioDesabilitados(): void {
    const campos = [...this.elementoDaPagina.querySelectorAll<HTMLInputElement>('ui-drawer input')];
    expect(campos.length).toBeGreaterThan(0);
    expect(campos.every((campo) => campo.matches(':disabled'))).toBe(true);
  }

  conferirCamposDaGradeDesabilitados(): void {
    const inputs = [...this.elementoDaPagina.querySelectorAll<HTMLInputElement>('.pe-grid input')];
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((input) => input.matches(':disabled'))).toBe(true);
  }

  linhasEmEdicaoDesabilitadas(): boolean[] {
    return this.formularioDaEdicao().controls.map((grupo) => grupo.disabled);
  }

  gruposDoCadastroDesabilitados(): boolean[] {
    return this.criacao.form.controls.grupos.controls.map((grupo) => grupo.disabled);
  }

  blocosDoDrawerDesabilitados(): boolean[] {
    const blocos = this.elementoDaPagina.querySelectorAll<HTMLFieldSetElement>(
      'ui-drawer fieldset.field-group',
    );
    return [...blocos].map((bloco) => bloco.disabled);
  }

  legendasDosGrupos(): (string | undefined)[] {
    return Array.from(this.elementoDaPagina.querySelectorAll('.field-group legend'), (legenda) =>
      legenda.textContent?.replace(/\s+/g, ' ').trim(),
    );
  }

  /** Cria pelo modelo e devolve os POST. */
  async enviarCriacaoPeloModelo(): Promise<TestRequest[]> {
    this.criacao.criar();
    await this.atualizarAplicacao();
    return this.controller.match((r) => r.url === ESCRITA);
  }

  /** Reenvia a criação e devolve o único POST pendente. */
  async reenviarCriacaoPeloModelo(): Promise<TestRequest> {
    this.criacao.criar();
    await this.atualizarAplicacao();
    return this.controller.expectOne((r) => r.url === ESCRITA);
  }

  inputDaEdicao(campo: 'peso' | 'corte', grupo: number, area: number): HTMLInputElement {
    const input = this.elementoDaPagina.querySelector<HTMLInputElement>(
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
