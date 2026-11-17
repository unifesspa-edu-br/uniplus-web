import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { GEO_BASE_PATH } from '@uniplus/shared-data/geo';
import {
  ESPERA_DA_DIGITACAO_MS,
  EnderecoGeoComponent,
  type EnderecoEstruturado,
} from '@uniplus/shared-ui/components';
import { ligarRelogioControlado, passarOTempo } from '@uniplus/shared-testing';
import { expect, vi } from 'vitest';
import { ENDERECO_NO_GEO } from './provedores-do-geo';

export const BASE_DO_GEO = 'http://localhost:5000';
const BUSCA_DE_CIDADES = `${BASE_DO_GEO}/api/cidades`;

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, EnderecoGeoComponent],
  providers: [ENDERECO_NO_GEO],
  template: `<ui-endereco-geo [formControl]="controle" idPrefix="t" [erroExterno]="erro()" />`,
})
export class AnfitriaoDoEnderecoComponent {
  readonly controle = new FormControl<EnderecoEstruturado | null>(null);
  readonly erro = signal<string | null>(null);
}

export const CEP_RESOLVIDO_ATE_O_LOGRADOURO = {
  cep: '68507590',
  tipo: 'Rua',
  logradouro: 'Folha 31, Quadra 7',
  complemento: null,
  bairro: 'Nova Marabá',
  distrito: null,
  cidade: 'Marabá',
  codigoIbge: '1504208',
  uf: 'PA',
  latitude: '-5.368',
  longitude: '-49.118',
  nivelResolucao: 'logradouro',
  origem: 'geo-api',
};

function configurarModuloDoEndereco(): void {
  TestBed.configureTestingModule({
    imports: [AnfitriaoDoEnderecoComponent],
    providers: [
      provideHttpClient(withInterceptors([apiResultInterceptor])),
      provideHttpClientTesting(),
      { provide: GEO_BASE_PATH, useValue: BASE_DO_GEO },
    ],
  });
}

/**
 * O endereço do Geo montado num anfitrião, com as ações da pessoa nos campos e as respostas do Geo.
 * O cenário liga o relógio controlado antes de criar o anfitrião, e `encerrar` o devolve ao real.
 */
export class CenarioDoEndereco {
  private constructor(
    readonly fixture: ComponentFixture<AnfitriaoDoEnderecoComponent>,
    readonly controller: HttpTestingController,
  ) {}

  static montar(): CenarioDoEndereco {
    ligarRelogioControlado();
    try {
      return CenarioDoEndereco.criarComRelogioLigado();
    } catch (erro) {
      vi.useRealTimers();
      throw erro;
    }
  }

  private static criarComRelogioLigado(): CenarioDoEndereco {
    configurarModuloDoEndereco();
    const fixture = TestBed.createComponent(AnfitriaoDoEnderecoComponent);
    fixture.detectChanges();
    return new CenarioDoEndereco(fixture, TestBed.inject(HttpTestingController));
  }

  get anfitriao(): AnfitriaoDoEnderecoComponent {
    return this.fixture.componentInstance;
  }

  /** Confere que nenhuma requisição ficou sem resposta e devolve o relógio real. */
  encerrar(): void {
    try {
      this.controller.verify();
    } finally {
      vi.useRealTimers();
    }
  }

  digitarNoCampo(id: string, valor: string): void {
    const campo = this.fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  botaoComTexto(texto: string): HTMLButtonElement {
    const botoes = Array.from(
      this.fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const alvo = botoes.find((botao) => botao.textContent?.includes(texto));
    if (alvo === undefined) {
      throw new Error(`Botão "${texto}" não encontrado`);
    }
    return alvo;
  }

  /** Escolhe a UF do endereço sem CEP. */
  escolherUf(sigla: string): void {
    const uf = this.fixture.nativeElement.querySelector('#t-uf') as HTMLSelectElement;
    uf.value = sigla;
    uf.dispatchEvent(new Event('change'));
    this.fixture.detectChanges();
  }

  /** Escolhe a UF e busca a cidade no campo de município, escolhendo a opção achada pelo Geo. */
  async escolherCidade(): Promise<void> {
    this.escolherUf('PA');
    await this.buscarCidade('Mara');
    this.responderBuscaDeCidades();
    this.escolherOpcaoDaCidade('Marabá (PA)');
  }

  /** Digita no campo de município e deixa passar a espera da digitação da busca. */
  async buscarCidade(texto: string): Promise<void> {
    this.digitarNaCidade(texto);
    await passarOTempo(ESPERA_DA_DIGITACAO_MS);
  }

  digitarNaCidade(texto: string): void {
    const campo = this.fixture.nativeElement.querySelector(
      'input[role="combobox"]',
    ) as HTMLInputElement;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    this.fixture.detectChanges();
  }

  semBuscaDeCidades(): void {
    this.controller.expectNone((req) => req.url === BUSCA_DE_CIDADES);
  }

  responderBuscaDeCidades(): void {
    const busca = this.buscaDeCidades();
    expect(busca.request.params.get('q')).toBe('Mara');
    expect(busca.request.params.get('uf')).toBe('PA');
    busca.flush([{ id: 'c1', codigoIbge: '1504208', nome: 'Marabá', uf: 'PA', ddd: '94' }]);
    this.fixture.detectChanges();
  }

  falharBuscaDeCidades(): void {
    this.buscaDeCidades().flush(null, { status: 500, statusText: 'Server Error' });
    this.fixture.detectChanges();
  }

  private buscaDeCidades(): TestRequest {
    return this.controller.expectOne((req) => req.url === BUSCA_DE_CIDADES);
  }

  private escolherOpcaoDaCidade(rotulo: string): void {
    const opcao = Array.from(
      this.fixture.nativeElement.querySelectorAll('[role="option"]') as NodeListOf<HTMLElement>,
    ).find((item) => item.textContent?.includes(rotulo));
    if (opcao === undefined) {
      throw new Error('A cidade buscada não apareceu entre as opções');
    }
    opcao.dispatchEvent(new MouseEvent('mousedown'));
    this.fixture.detectChanges();
  }
}
