import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { MockInstance, expect, vi } from 'vitest';
import { InteracaoComATela } from '../interacao-com-a-tela/interacao-com-a-tela.testing';

export const BASE_DA_API = 'http://localhost:5000';

export type RespostaDaApi = readonly [
  string | null,
  { status: number; statusText: string; headers?: Record<string, string> },
];

export function problema(status: number, code: string, title: string, errors?: unknown[]) {
  const corpo = { type: 'about:blank', title, status, code, traceId: 't', errors };
  return [
    JSON.stringify(corpo),
    { status, statusText: title, headers: { 'content-type': 'application/problem+json' } },
  ] as const;
}

interface EdicaoComFormulario<Valores> {
  readonly form: { setValue(valores: Valores): void };
}

/** O que muda de um cadastro simples para outro; o restante da condução da página é comum. */
export interface CadastroEmTeste<
  Pagina,
  Edicao extends EdicaoComFormulario<Valores>,
  Store,
  Item,
  Valores,
> {
  readonly pagina: Type<Pagina>;
  readonly edicao: Type<Edicao>;
  readonly store: Type<Store>;
  /** URL da listagem. */
  readonly lista: string;
  /** Identificador do formulário, sem `#`. */
  readonly formulario: string;
  /** Substantivo que inicia o rótulo dos botões da linha, como em "Editar reserva". */
  readonly objetoDaAcao: string;
  readonly itemInicial: Item;
  readonly valoresValidos: Valores;
  /** Trecho que o diálogo de remoção deve exibir, quando o cadastro o confere. */
  readonly textoDaConfirmacaoDeRemocao?: string;
}

function prepararModulo(pagina: Type<unknown>): void {
  TestBed.configureTestingModule({
    imports: [pagina],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE_DA_API },
    ],
  });
}

/** A página de um cadastro simples montada com a lista carregada, conduzida como o operador. */
export class PaginaDeCadastro<
  Pagina,
  Edicao extends EdicaoComFormulario<Valores>,
  Store,
  Item,
  Valores,
> {
  readonly fixture: ComponentFixture<Pagina>;
  readonly controller: HttpTestingController;
  readonly edicao: Edicao;
  readonly store: Store;
  readonly sucesso: MockInstance<NotificationService['success']>;
  readonly erroDoServidor: MockInstance<NotificationService['errorFromProblem']>;
  readonly propagar: InteracaoComATela['propagar'];
  readonly elemento: InteracaoComATela['elemento'];
  readonly #cadastro: CadastroEmTeste<Pagina, Edicao, Store, Item, Valores>;

  private constructor(cadastro: CadastroEmTeste<Pagina, Edicao, Store, Item, Valores>) {
    prepararModulo(cadastro.pagina);
    this.#cadastro = cadastro;
    this.fixture = TestBed.createComponent(cadastro.pagina);
    this.controller = TestBed.inject(HttpTestingController);
    this.edicao = this.fixture.debugElement.injector.get(cadastro.edicao);
    this.store = this.fixture.debugElement.injector.get(cadastro.store);
    const notificacoes = TestBed.inject(NotificationService);
    this.sucesso = vi.spyOn(notificacoes, 'success');
    this.erroDoServidor = vi.spyOn(notificacoes, 'errorFromProblem');
    const tela = new InteracaoComATela(this.fixture);
    this.propagar = tela.propagar;
    this.elemento = tela.elemento;
  }

  static async montar<Pagina, Edicao extends EdicaoComFormulario<Valores>, Store, Item, Valores>(
    cadastro: CadastroEmTeste<Pagina, Edicao, Store, Item, Valores>,
  ): Promise<PaginaDeCadastro<Pagina, Edicao, Store, Item, Valores>> {
    const pagina = new PaginaDeCadastro(cadastro);
    pagina.fixture.detectChanges();
    await pagina.listar([cadastro.itemInicial]);
    return pagina;
  }

  async aguardarFoco(): Promise<void> {
    await this.propagar();
    await this.fixture.whenStable();
    await this.propagar();
  }

  elementoDaPagina(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  indisponivel(seletor: string): boolean {
    return this.elemento(seletor).matches(':disabled');
  }

  salvar(): HTMLButtonElement {
    return this.elemento(`button[form="${this.#cadastro.formulario}"]`);
  }

  confirmar(): HTMLButtonElement {
    return this.elemento('[data-testid="confirm-dialog-confirm"]');
  }

  campo(nome: string): HTMLInputElement {
    return this.elemento(`[formcontrolname="${nome}"]`) as HTMLInputElement;
  }

  novo(): HTMLButtonElement {
    return this.elemento('.panel-head .btn--primary');
  }

  acaoDaLinha(verbo: 'Editar' | 'Remover'): HTMLButtonElement {
    const objeto = this.#cadastro.objetoDaAcao;
    return this.elemento(`td.table-responsive__actions button[aria-label^="${verbo} ${objeto}"]`);
  }

  retentar(): HTMLButtonElement {
    return this.elemento('.list-state__retry button');
  }

  async listar(itens: readonly Item[]): Promise<void> {
    this.controller.expectOne((r) => r.url === this.#cadastro.lista).flush(itens);
    await this.propagar();
  }

  async preencher(): Promise<void> {
    this.novo().click();
    await this.propagar();
    this.edicao.form.setValue(this.#cadastro.valoresValidos);
    await this.propagar();
  }

  async enviar(): Promise<void> {
    this.salvar().focus();
    this.elemento<HTMLFormElement>(`#${this.#cadastro.formulario}`).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await this.propagar();
  }

  async responder(url: string, resposta: RespostaDaApi): Promise<void> {
    this.controller.expectOne(url).flush(...resposta);
    await this.propagar();
    await this.aguardarFoco();
  }

  async concluirRecarga(itens: readonly Item[] = [this.#cadastro.itemInicial]): Promise<void> {
    await this.propagar();
    await this.listar(itens);
    await this.aguardarFoco();
  }

  async pedirRemocao(): Promise<void> {
    this.acaoDaLinha('Remover').click();
    await this.propagar();
    const texto = this.#cadastro.textoDaConfirmacaoDeRemocao;
    if (texto !== undefined) expect(this.elemento('ui-dialog').textContent).toContain(texto);
  }

  async confirmarRemocao(): Promise<void> {
    await this.pedirRemocao();
    this.confirmar().click();
    await this.propagar();
  }
}
