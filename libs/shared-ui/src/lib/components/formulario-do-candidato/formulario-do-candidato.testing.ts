import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { okResult } from '@uniplus/shared-testing';

import { BUSCA_DE_MUNICIPIOS } from '../editor-de-condicoes/valor-de-municipio';
import { BUSCA_DE_CEP, type BuscaDeCep } from '../endereco-geo/endereco-geo.model';

import { FormularioDoCandidatoComponent } from './formulario-do-candidato';
import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import type { SimulacaoDoFormulario } from './interpretador/regras-do-formulario';
import { CEP_DE_MARABA, MUNICIPIO_DE_MARABA } from './formularios-de-exemplo.testing';

export class CenarioDoFormularioDoCandidato {
  fixture!: ComponentFixture<FormularioDoCandidatoComponent>;
  simulacoes: SimulacaoDoFormulario[] = [];
  resultadoDoCep: (cep: string) => ReturnType<BuscaDeCep> = () => of(okResult(CEP_DE_MARABA));

  static preparar(): CenarioDoFormularioDoCandidato {
    const cenario = new CenarioDoFormularioDoCandidato();
    TestBed.configureTestingModule({
      providers: [
        { provide: BUSCA_DE_MUNICIPIOS, useValue: () => of(okResult([MUNICIPIO_DE_MARABA])) },
        { provide: BUSCA_DE_CEP, useValue: (cep: string) => cenario.resultadoDoCep(cep) },
      ],
    });
    return cenario;
  }

  get tela(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  montar(
    formulario: FormularioDoCandidato,
    entradas: Readonly<Record<string, unknown>> = {},
  ): HTMLElement {
    this.fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    this.fixture.componentRef.setInput('formulario', formulario);
    for (const [nome, valor] of Object.entries(entradas))
      this.fixture.componentRef.setInput(nome, valor);
    this.simulacoes = [];
    this.fixture.componentInstance.simulacaoChange.subscribe((s) => this.simulacoes.push(s));
    this.fixture.detectChanges();
    return this.tela;
  }

  /** As respostas da última simulação; sem elas, a ausência de um campo não provaria nada. */
  respostasDaUltimaSimulacao(): NonNullable<SimulacaoDoFormulario['respostas']> {
    const respostas = this.simulacoes.at(-1)?.respostas;
    if (respostas === undefined || respostas === null) {
      throw new Error('a última simulação não trouxe respostas');
    }
    return respostas;
  }

  opcao(texto: string): HTMLInputElement {
    return [...this.tela.querySelectorAll('label')]
      .find((l) => l.textContent?.trim() === texto)
      ?.querySelector('input') as HTMLInputElement;
  }

  clicar(elemento: HTMLElement): void {
    elemento.click();
    this.fixture.detectChanges();
  }

  botao(texto: string): HTMLButtonElement {
    return [...this.tela.querySelectorAll('button')].find((b) =>
      b.textContent?.trim().startsWith(texto),
    ) as HTMLButtonElement;
  }

  /** O estado do passo mora no item da lista, que contém o botão. */
  itemDoPasso(texto: string): HTMLElement {
    return this.botao(texto).closest('li') as HTMLElement;
  }

  digitar(input: HTMLInputElement, texto: string): void {
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    this.fixture.detectChanges();
  }
}
