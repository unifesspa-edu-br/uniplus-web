import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CampusDto, CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import type { EnderecoEstruturado } from '@uniplus/shared-ui/components';
import { expect } from 'vitest';
import {
  InteracaoComATela,
  digitar,
} from '../../shared/interacao-com-a-tela/interacao-com-a-tela.testing';
import { CampiPage } from './campi.page';
import { CampiStore } from './campi.store';
import { EdicaoDosCampi } from './edicao-dos-campi';

const BASE = 'http://localhost:5000';
export const LISTA_URL = `${BASE}/api/configuracao/campi`;
export const ESCRITA_URL = `${BASE}/api/configuracao/admin/campi`;
const ATIVADOR_DO_PAINEL = '.panel-head .btn--primary';
const BOTAO_DE_SALVAR = 'button[form="cfg-campus-form"]';
const CAMPO_DA_SIGLA = 'input[formcontrolname="sigla"]';

export const campusSeed: CampusDto = {
  id: '01960000-0000-7000-0000-0000000000b1',
  sigla: 'MARABA',
  nome: 'Campus de Marabá',
  codigoEmec: '12345',
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

export const enderecoResolvido: EnderecoEstruturado = {
  cep: '68507590',
  logradouro: 'Folha 31',
  numero: 's/n',
  complemento: null,
  bairro: 'Nova Marabá',
  distrito: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  latitude: null,
  longitude: null,
  nivelResolucao: 'logradouro',
  origem: 'geo-api',
};

export function recusaDeValidacao(field: string, code: string, message: string): object {
  return {
    type: 'about:blank',
    title: 'Dados inválidos',
    status: 422,
    code: 'uniplus.validacao',
    traceId: 'test-trace',
    errors: [{ field, code, message }],
  };
}

export const recusaDaSigla = recusaDeValidacao(
  'Sigla',
  'uniplus.configuracao.campus.sigla_ja_existe',
  'Sigla já cadastrada.',
);

export const recusaDaCidadeDoEndereco = recusaDeValidacao(
  'CidadeCodigoIbge',
  'uniplus.configuracao.campus.cidade_divergente',
  'A cidade não corresponde ao CEP informado.',
);

function prepararModulo(): void {
  TestBed.configureTestingModule({
    imports: [CampiPage],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      { provide: GEO_BASE_PATH, useValue: BASE },
    ],
  });
}

/** A página de campi montada com a lista já carregada, conduzida como o operador: cliques e digitação. */
export class PaginaDeCampi {
  readonly fixture: ComponentFixture<CampiPage>;
  readonly edicao: EdicaoDosCampi;
  readonly store: CampiStore;
  readonly controller: HttpTestingController;
  readonly #tela: InteracaoComATela;

  private constructor() {
    prepararModulo();
    this.fixture = TestBed.createComponent(CampiPage);
    this.edicao = this.fixture.debugElement.injector.get(EdicaoDosCampi);
    this.store = this.fixture.debugElement.injector.get(CampiStore);
    this.controller = TestBed.inject(HttpTestingController);
    this.#tela = new InteracaoComATela(this.fixture);
  }

  static async montar(): Promise<PaginaDeCampi> {
    const pagina = new PaginaDeCampi();
    pagina.fixture.detectChanges();
    await pagina.responderLista();
    return pagina;
  }

  propagar(): Promise<void> {
    return this.#tela.propagar();
  }

  elemento<T extends HTMLElement>(seletor: string): T {
    return this.#tela.elemento<T>(seletor);
  }

  digitar(seletor: string, valor: string): void {
    digitar(this.elemento<HTMLInputElement>(seletor), valor);
  }

  async responderLista(): Promise<void> {
    this.controller.expectOne((r) => r.url === LISTA_URL).flush([campusSeed]);
    await this.propagar();
  }

  async abrirNovoCampus(): Promise<void> {
    this.elemento<HTMLButtonElement>(ATIVADOR_DO_PAINEL).click();
    await this.propagar();
    this.digitar(CAMPO_DA_SIGLA, 'PARAUAPEBAS');
    this.digitar('input[formcontrolname="nome"]', 'Campus de Parauapebas');
  }

  /** O endereço é um controle composto resolvido pelo Geo; os demais campos são digitados. */
  async preencherNovoCampus(): Promise<void> {
    await this.abrirNovoCampus();
    this.edicao.form.controls.endereco.setValue(enderecoResolvido);
  }

  enviarFormulario(): void {
    this.elemento<HTMLButtonElement>(BOTAO_DE_SALVAR).click();
  }

  async pedirRemocao(): Promise<void> {
    this.elemento<HTMLButtonElement>('button[aria-label="Remover campus MARABA"]').click();
    await this.propagar();
    this.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    await this.propagar();
  }

  recusar(corpo: object): void {
    this.controller.expectOne(ESCRITA_URL).flush(JSON.stringify(corpo), {
      status: 422,
      statusText: 'Unprocessable Entity',
      headers: { 'content-type': 'application/problem+json' },
    });
  }

  botao(seletor: string, texto: string): HTMLButtonElement {
    const botoes = (this.fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      seletor,
    );
    const achado = [...botoes].find((b) => b.textContent?.trim() === texto);
    expect(achado, `${seletor} "${texto}"`).toBeDefined();
    return achado as HTMLButtonElement;
  }

  drawerDoFormulario(): HTMLDialogElement {
    return this.elemento<HTMLDialogElement>('dialog[aria-label="Formulário de campus"]');
  }
}
