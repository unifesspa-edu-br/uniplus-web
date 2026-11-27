import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { expect } from 'vitest';

/** Interações de teste que agem como a pessoa: pelos elementos da tela, nunca pelos serviços. */

type Campo = HTMLInputElement | HTMLTextAreaElement;

export function digitar(campo: Campo, valor: string): void {
  campo.value = valor;
  campo.dispatchEvent(new Event('input'));
}

export function escolherNaLista(lista: HTMLSelectElement, valor: string): void {
  lista.value = valor;
  lista.dispatchEvent(new Event('change'));
}

export function botaoComTexto(raiz: ParentNode, texto: string): HTMLButtonElement | undefined {
  return [...raiz.querySelectorAll('button')].find((b) => b.textContent?.trim() === texto);
}

/** O diálogo da tela cujo título é o dado. */
export function dialogoComTitulo(raiz: ParentNode, titulo: string): HTMLDialogElement | undefined {
  const dialogos = [...raiz.querySelectorAll('dialog')];
  return dialogos.find((d) => d.querySelector('h3')?.textContent?.trim() === titulo);
}

function existente<T>(valor: T | null | undefined, descricao: string): T {
  if (valor == null) throw new Error(`não achei ${descricao}`);
  return valor;
}

/** O campo de texto cujo rótulo começa com o texto dado. */
export function campoPorRotulo(raiz: ParentNode, rotulo: string): Campo {
  const dono = [...raiz.querySelectorAll('label.field')].find((l) =>
    l.querySelector('.field__label')?.textContent?.trim().startsWith(rotulo),
  );
  return existente(dono?.querySelector<Campo>('input, textarea'), `o campo ${rotulo}`);
}

/** A lista de escolha (`select`) cujo rótulo é o dado. */
export function listaPorRotulo(raiz: ParentNode, rotulo: string): HTMLSelectElement {
  const dono = [...raiz.querySelectorAll('label.field__label')].find(
    (l) => l.textContent?.trim() === rotulo,
  );
  const id = existente(dono?.getAttribute('for'), `a lista ${rotulo}`);
  return existente(raiz.querySelector<HTMLSelectElement>(`#${id}`), `a lista ${rotulo}`);
}

/** A caixa de marcar da permissão de nome dado. */
export function caixaDaPermissao(raiz: ParentNode, nome: string): HTMLInputElement {
  const rotulo = [...raiz.querySelectorAll('label.checkbox')].find((l) =>
    l.textContent?.includes(nome),
  );
  return existente(rotulo?.querySelector('input'), `a permissão ${nome}`);
}

/** Os códigos das permissões marcadas, na ordem da tela. */
export function codigosMarcados(raiz: ParentNode): string[] {
  const marcadas = raiz.querySelectorAll<HTMLInputElement>('label.checkbox input:checked');
  return [...marcadas].map((i) => i.closest('label')?.querySelector('code')?.textContent ?? '');
}

/** Escolhe o arquivo no `<input type="file">` da raiz, como o navegador faz; sem arquivo, escolhe nenhum. */
export function escolherArquivoNoCampo(raiz: ParentNode, arquivo: File | null): void {
  const campo = existente(
    raiz.querySelector<HTMLInputElement>('input[type="file"]'),
    'o campo de arquivo',
  );
  Object.defineProperty(campo, 'files', {
    value: arquivo === null ? [] : [arquivo],
    configurable: true,
  });
  campo.dispatchEvent(new Event('change'));
}

type TelaMontada = Pick<ComponentFixture<unknown>, 'detectChanges' | 'nativeElement'>;

/** As interações com a tela de um componente montado: achar elementos, preencher, responder e acionar. */
export class InteracaoComATela {
  readonly #aplicacao = TestBed.inject(ApplicationRef);
  readonly #tela: TelaMontada;

  constructor(tela: TelaMontada) {
    this.#tela = tela;
  }

  readonly propagar = async (): Promise<void> => {
    await Promise.resolve();
    this.#aplicacao.tick();
    this.#tela.detectChanges();
  };

  readonly elemento = <E extends HTMLElement>(seletor: string): E => {
    const encontrado = (this.#tela.nativeElement as HTMLElement).querySelector<E>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as E;
  };

  readonly pelaEtiqueta = (nome: string): HTMLButtonElement =>
    this.elemento(`button[aria-label="${nome}"]`);

  readonly preencher = (nome: string, valor: string): void =>
    digitar(this.elemento<HTMLInputElement>(`[formcontrolname="${nome}"]`), valor);

  /** Marca "Sim" ou "Não" do atributo, clicando na opção como a pessoa faz. */
  readonly responder = (nome: string, sim: boolean): void => {
    const opcoes = (this.#tela.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
      `input[type="radio"][name="${nome}"]`,
    );
    opcoes[sim ? 0 : 1].click();
  };

  readonly acionar = async (botao: HTMLButtonElement): Promise<void> => {
    botao.focus();
    botao.click();
    await this.propagar();
  };
}
