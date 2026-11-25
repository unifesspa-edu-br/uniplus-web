import type { Provider } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { SO_IGUALDADE } from '../editor-de-condicoes/operadores-de-exemplo.testing';
import { EditorDeFormularioComponent } from './editor-de-formulario';
import type {
  ApresentacaoDoCampo,
  ConteudoDoFormulario,
  FatoDoFormulario,
  GrupoDoFormulario,
  ItemDoFormulario,
  RegrasDoCampo,
} from './modelo/tipos';

export const fato = (codigo: string): FatoDoFormulario => ({
  codigo,
  nome: codigo,
  dominio: { codigo: 'SIM_OU_NAO', rotulo: 'SIM_OU_NAO' },
  binding: `CAMPO_FORMULARIO:${codigo}`,
  operadoresAdmitidos: SO_IGUALDADE,
  cardinalidade: { codigo: 'VALOR_UNICO', rotulo: 'VALOR_UNICO' },
  fonteValores: null,
  escopo: 'CANDIDATO',
  ativo: true,
});

interface ExtraDoItem {
  readonly etapaCodigo?: null | string;
  readonly apresentacao?: Partial<ApresentacaoDoCampo>;
  readonly regras?: Partial<RegrasDoCampo>;
}

const REGRAS_PADRAO: RegrasDoCampo = {
  exibicao: null,
  obrigatoriedade: { tipo: 'SEMPRE', predicado: null },
};

const apresentacaoDe = (
  fatoCodigo: string,
  extra?: Partial<ApresentacaoDoCampo>,
): ApresentacaoDoCampo => ({
  rotulo: `Campo ${fatoCodigo}`,
  tipoDeCampo: 'SIM_OU_NAO',
  pedirConfirmacao: false,
  ...extra,
});

export const item = (
  fatoCodigo: string,
  ordem: number,
  extra: ExtraDoItem = {},
): ItemDoFormulario => ({
  fatoCodigo,
  ordem,
  etapaCodigo: extra.etapaCodigo === undefined ? 'S1' : extra.etapaCodigo,
  apresentacao: apresentacaoDe(fatoCodigo, extra.apresentacao),
  regras: { ...REGRAS_PADRAO, ...extra.regras },
});

export const conteudo: ConteudoDoFormulario = {
  titulo: null,
  etapas: [
    {
      codigo: 'S1',
      ordem: 0,
      tipo: 'SECAO',
      bloco: null,
      apresentacao: { titulo: 'Escolaridade', descricao: null, aviso: null },
    },
  ],
  itens: [
    item('A', 0),
    item('B', 1, { regras: { exibicao: [[{ fato: 'A', operador: 'IGUAL', valor: true }]] } }),
    item('C', 2),
  ],
  termos: [],
  pressupostos: [],
  grupos: [],
};

export const FAMILIA: GrupoDoFormulario = {
  codigo: 'FAMILIA',
  ordem: 3,
  rotulo: 'Família',
  etapaCodigo: 'S1',
  ocorrencias: { minimo: 0, maximo: null, incluiCandidato: false },
  regras: REGRAS_PADRAO,
  subitens: [],
};

export class CenarioDoEditorDeFormulario {
  fixture!: ComponentFixture<EditorDeFormularioComponent>;
  emitidos: ConteudoDoFormulario[] = [];

  static preparar(provedores: Provider[] = []): CenarioDoEditorDeFormulario {
    TestBed.configureTestingModule({ providers: provedores });
    return new CenarioDoEditorDeFormulario();
  }

  get tela(): HTMLElement {
    return this.fixture.nativeElement as HTMLElement;
  }

  montar(): void {
    this.fixture = TestBed.createComponent(EditorDeFormularioComponent);
    this.entrada('conteudo', conteudo);
    this.entrada('catalogo', [fato('A'), fato('B'), fato('C')]);
    this.entrada('finalidade', 'INSCRICAO');
    this.entrada('idBase', 'f');
    this.fixture.componentInstance.conteudoChange.subscribe((novo) => this.receber(novo));
    this.detectar();
  }

  entrada(nome: string, valor: unknown): void {
    this.fixture.componentRef.setInput(nome, valor);
  }

  detectar(): void {
    this.fixture.detectChanges();
  }

  status(): string {
    return this.tela.querySelector('[role="status"]')?.textContent?.trim() ?? '';
  }

  clicar(id: string): void {
    (this.tela.querySelector(`#${id}`) as HTMLButtonElement).click();
  }

  /** Abre a busca de fatos, filtrada pelo termo quando há um, e devolve os nomes que ela oferece. */
  ofertadosEm(id: string, termo = ''): string[] {
    const campo = this.tela.querySelector(`#${id} [role="combobox"]`) as HTMLInputElement;
    campo.dispatchEvent(new Event('focus'));
    if (termo !== '') {
      campo.value = termo;
      campo.dispatchEvent(new Event('input'));
    }
    this.detectar();
    return this.opcoesDe(id).map((opcao) => opcao.textContent?.trim() ?? '');
  }

  escolherEm(id: string, nome: string, termo = ''): void {
    this.ofertadosEm(id, termo);
    this.opcoesDe(id)
      .find((opcao) => opcao.textContent?.trim() === nome)
      ?.dispatchEvent(new MouseEvent('mousedown'));
    this.detectar();
  }

  acrescentarCampo(): void {
    const botoes = [...this.tela.querySelectorAll('button')];
    const acrescentar = botoes.find((b) => b.textContent?.includes('Acrescentar campo'));
    (acrescentar as HTMLButtonElement).click();
    this.detectar();
  }

  comGrupo(minimo: number | string, maximo: number | string | null): void {
    const ocorrencias = { minimo, maximo, incluiCandidato: false };
    this.entrada('conteudo', { ...conteudo, grupos: [{ ...FAMILIA, ocorrencias }] });
    this.detectar();
  }

  private opcoesDe(id: string): Element[] {
    return [...this.tela.querySelectorAll(`#${id} [role="option"]`)];
  }

  private receber(novo: ConteudoDoFormulario): void {
    this.emitidos.push(novo);
    this.entrada('conteudo', novo);
  }
}
