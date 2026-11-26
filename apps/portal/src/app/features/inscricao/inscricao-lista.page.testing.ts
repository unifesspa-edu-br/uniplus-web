import { HttpHeaders } from '@angular/common/http';
import { ApplicationRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import { type MockInstance, vi } from 'vitest';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { type ApiResult, apiOk } from '@uniplus/shared-core/http';
import {
  type AcoesDaInscricaoDto,
  type MinhaInscricaoDto,
  type MotivoDasInscricoesFechadasCodigo,
  SituacaoInscricaoCodigo,
} from '@uniplus/shared-data/selecao';

import type { ItemDaLista } from './inscricao-lista.model';
import { InscricaoListaPage } from './inscricao-lista.page';
import { MinhasInscricoesService } from './minhas-inscricoes.service';

export const CHAVE_DA_VISAO = 'uniplus.portal.inscricao-lista-visao';

type Visao = 'lista' | 'cards';

interface ComExecutar {
  executar(acao: unknown, item: ItemDaLista): void;
}

interface ComVisao {
  visao: { set(visao: Visao): void };
  visaoEfetiva: () => Visao;
}

const ROTULO_DA_SITUACAO: Record<SituacaoInscricaoCodigo, string> = {
  [SituacaoInscricaoCodigo.RASCUNHO]: 'Rascunho',
  [SituacaoInscricaoCodigo.ENVIADA]: 'Enviada',
  [SituacaoInscricaoCodigo.CANCELADA]: 'Cancelada',
};

const CURSO_ESCOLHIDO = { ordem: 1, cursoNome: 'Medicina', cursoGrau: 'Bacharelado' };

type DadosDaSituacao = Pick<
  MinhaInscricaoDto,
  | 'situacao'
  | 'numeroInscricao'
  | 'opcoesDeCurso'
  | 'canceladaEm'
  | 'motivoDoCancelamento'
  | 'numeroDoUltimoComprovante'
>;

/** O que só a situação define: o rascunho não tem número, curso nem comprovante. */
function dadosDaSituacao(situacao: SituacaoInscricaoCodigo): DadosDaSituacao {
  const rascunho = situacao === SituacaoInscricaoCodigo.RASCUNHO;
  const semComprovante = rascunho || situacao === SituacaoInscricaoCodigo.CANCELADA;
  return {
    situacao: { codigo: situacao, rotulo: ROTULO_DA_SITUACAO[situacao] },
    numeroInscricao: rascunho ? null : '00000042',
    opcoesDeCurso: rascunho ? [] : [CURSO_ESCOLHIDO],
    canceladaEm: null,
    motivoDoCancelamento: null,
    numeroDoUltimoComprovante: semComprovante ? null : 3,
  };
}

function acoesDe(situacao: SituacaoInscricaoCodigo, aberta: boolean): AcoesDaInscricaoDto {
  const enviada = situacao === SituacaoInscricaoCodigo.ENVIADA;
  const rascunho = situacao === SituacaoInscricaoCodigo.RASCUNHO;
  return {
    podeContinuar: rascunho && aberta,
    podeCorrigir: enviada && aberta,
    podeCancelar: enviada && aberta,
    podeDescartar: rascunho && aberta,
  };
}

/** Um item da lista na situação pedida: com curso quando não é rascunho, e ações conforme `aberta`. */
export function inscricao(
  id: string,
  situacao: SituacaoInscricaoCodigo,
  nomeDoProcesso: string | null,
  aberta = true,
): MinhaInscricaoDto {
  return {
    inscricaoId: `i-${id}`,
    processoSeletivoId: id,
    nomeDoProcesso,
    ...dadosDaSituacao(situacao),
    acoes: acoesDe(situacao, aberta),
    motivoDasInscricoesFechadas: null,
  };
}

/**
 * O rascunho que a API não deixa continuar, com o motivo que ela informa. O código entra como texto
 * para o teste poder levar à lista um valor que o contrato ainda não tem.
 */
export function rascunhoSemContinuar(
  id: string,
  nomeDoProcesso: string,
  motivo: string | null,
): MinhaInscricaoDto {
  return {
    ...inscricao(id, SituacaoInscricaoCodigo.RASCUNHO, nomeDoProcesso, false),
    motivoDasInscricoesFechadas: motivo
      ? { codigo: motivo as MotivoDasInscricoesFechadasCodigo, rotulo: 'Rótulo do motivo' }
      : null,
  };
}

export const INSCRICOES: readonly MinhaInscricaoDto[] = [
  inscricao('p1', SituacaoInscricaoCodigo.RASCUNHO, 'Auxílio estudantil 2026'),
  inscricao('p2', SituacaoInscricaoCodigo.ENVIADA, 'Bolsa de iniciação científica'),
  inscricao('p3', SituacaoInscricaoCodigo.ENVIADA, 'Morada estudantil'),
  inscricao('p4', SituacaoInscricaoCodigo.RASCUNHO, 'Auxílio transporte'),
];

export const respostaSemConteudo = (): Observable<ApiResult<void>> =>
  of(apiOk<void>(undefined, 204, new HttpHeaders()));

/**
 * Cada chamada a `listar()` entrega um Subject fresco, para que
 * `inscricoesResource.reload()` receba uma nova subscription controlável.
 */
export class StubListagemService {
  private readonly subjects: Subject<ApiResult<readonly MinhaInscricaoDto[]>>[] = [];

  listar(): Observable<ApiResult<readonly MinhaInscricaoDto[]>> {
    const sub = new Subject<ApiResult<readonly MinhaInscricaoDto[]>>();
    this.subjects.push(sub);
    return sub.asObservable();
  }

  get ultimo(): Subject<ApiResult<readonly MinhaInscricaoDto[]>> {
    return this.subjects[this.subjects.length - 1];
  }

  flush(inscricoes: readonly MinhaInscricaoDto[] = INSCRICOES): void {
    this.ultimo.next(apiOk(inscricoes, 200, new HttpHeaders()));
    this.ultimo.complete();
  }

  cancelar: (processoId: string, motivo: string | null) => Observable<ApiResult<void>> =
    respostaSemConteudo;

  descartar: (processoId: string) => Observable<ApiResult<void>> = respostaSemConteudo;

  rejeitar(): void {
    this.ultimo.error(new Error('Falha simulada no carregamento'));
  }
}

export class CenarioDaListaDeInscricoes {
  readonly listagem = new StubListagemService();
  readonly nomeDaPessoa = signal('');
  readonly fixture: ComponentFixture<InscricaoListaPage>;
  readonly component: InscricaoListaPage;
  private readonly appRef: ApplicationRef;
  private readonly mediaOriginal = window.matchMedia;

  private constructor() {
    localStorage.removeItem(CHAVE_DA_VISAO);
    this.simularMedia(false);
    this.configurarOTestBed();
    this.fixture = TestBed.createComponent(InscricaoListaPage);
    this.component = this.fixture.componentInstance;
    this.appRef = TestBed.inject(ApplicationRef);
  }

  static preparar(): CenarioDaListaDeInscricoes {
    const cenario = new CenarioDaListaDeInscricoes();
    cenario.fixture.detectChanges();
    return cenario;
  }

  restaurar(): void {
    window.matchMedia = this.mediaOriginal;
  }

  /** Faz toda consulta de mídia responder `corresponde`, como a tela estreita ou larga. */
  simularMedia(corresponde: boolean): void {
    window.matchMedia = ((consulta: string) =>
      ({
        matches: corresponde,
        media: consulta,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
  }

  tela(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  async propagar(): Promise<void> {
    await Promise.resolve();
    this.appRef.tick();
  }

  async assentar(): Promise<void> {
    await this.propagar();
    this.fixture.detectChanges();
  }

  async carregar(inscricoes: readonly MinhaInscricaoDto[] = INSCRICOES): Promise<void> {
    this.listagem.flush(inscricoes);
    await this.assentar();
  }

  async falharOCarregamento(): Promise<void> {
    this.listagem.rejeitar();
    await this.assentar();
  }

  /** Deixa passar uma macrotarefa, a que o foco pós-carregamento espera. */
  macrotarefa(): Promise<void> {
    return new Promise((resolver) => setTimeout(resolver));
  }

  definirNome(nome: string): void {
    this.nomeDaPessoa.set(nome);
    this.fixture.detectChanges();
  }

  itens(): NodeListOf<Element> {
    return this.tela().querySelectorAll('li.inscricao-lista-item');
  }

  dialogo(): HTMLDialogElement | null {
    return this.tela().querySelector('dialog');
  }

  botao(rotulo: string, raiz: ParentNode | null = this.tela()): HTMLButtonElement | null {
    const botoes = Array.from(raiz?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    return botoes.find((el) => el.textContent?.includes(rotulo)) ?? null;
  }

  rotulosDe(item: Element): string[] {
    return Array.from(item.querySelectorAll('button')).map((b) => b.textContent?.trim() ?? '');
  }

  clicarNoItem(posicao: number, rotulo: string): void {
    this.botao(rotulo, this.itens()[posicao])?.click();
  }

  abrirDialogoDoItem(posicao: number, rotulo: string): void {
    this.clicarNoItem(posicao, rotulo);
    this.fixture.detectChanges();
  }

  clicarNoDialogo(rotulo: string): void {
    this.botao(rotulo, this.dialogo())?.click();
  }

  situacaoDaNovaTentativa(): string {
    return this.tela().querySelector('ui-situacao-da-nova-tentativa')?.textContent ?? '';
  }

  espiarNavegacao(): MockInstance<Router['navigate']> {
    return vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  }

  espiarExecutar(): MockInstance<ComExecutar['executar']> {
    return vi.spyOn(this.component as unknown as ComExecutar, 'executar');
  }

  buscar(termo: string): void {
    this.component['termoBusca'].set(termo);
    this.fixture.detectChanges();
  }

  listaDoComponente(): readonly ItemDaLista[] {
    return this.component['lista']();
  }

  /** Abre outra instância da página numa tela estreita, já com a lista carregada. */
  async abrirEmTelaEstreita(): Promise<ComponentFixture<InscricaoListaPage>> {
    this.simularMedia(true);
    const estreita = TestBed.createComponent(InscricaoListaPage);
    estreita.detectChanges();
    this.listagem.flush();
    await this.propagar();
    estreita.detectChanges();
    return estreita;
  }

  escolherVisao(visao: Visao, pagina: ComponentFixture<InscricaoListaPage> = this.fixture): void {
    (pagina.componentInstance as unknown as ComVisao).visao.set(visao);
    pagina.detectChanges();
  }

  visaoEfetiva(pagina: ComponentFixture<InscricaoListaPage> = this.fixture): Visao {
    return (pagina.componentInstance as unknown as ComVisao).visaoEfetiva();
  }

  private configurarOTestBed(): void {
    TestBed.configureTestingModule({
      imports: [InscricaoListaPage],
      providers: [
        provideRouter([]),
        { provide: MinhasInscricoesService, useValue: this.listagem },
        { provide: UserContextService, useValue: { displayName: this.nomeDaPessoa } },
      ],
    });
  }
}
