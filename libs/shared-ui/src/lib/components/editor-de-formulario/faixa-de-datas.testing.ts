import type { CenarioDoEditorDeFormulario } from './editor-de-formulario.testing';
import { conteudo, fato, item } from './editor-de-formulario.testing';
import type { FatoDoFormulario, ItemDoFormulario, RegrasDoCampo } from './modelo/tipos';

export const data = (codigo: string): FatoDoFormulario => ({
  ...fato(codigo),
  dominio: 'DATA',
  operadoresAdmitidos: [],
});

const nascimento = (restricoes?: RegrasDoCampo['restricoes']): ItemDoFormulario =>
  item('NASCIMENTO', 1, { apresentacao: { tipoRenderizacao: 'DATA' }, regras: { restricoes } });

export class CenarioDaFaixaDeDatas {
  constructor(readonly editor: CenarioDoEditorDeFormulario) {}

  faixaDe(fatoCodigo: string): HTMLElement {
    return this.editor.tela.querySelector(
      `[aria-labelledby="f-item-${fatoCodigo}-titulo"]`,
    ) as HTMLElement;
  }

  limite(fatoCodigo: string, nome: string): HTMLElement {
    return [...this.faixaDe(fatoCodigo).querySelectorAll('fieldset')].find(
      (f) => f.querySelector('legend')?.textContent?.trim() === nome,
    ) as HTMLElement;
  }

  trocar(controle: HTMLInputElement | HTMLSelectElement, valor: string): void {
    controle.value = valor;
    controle.dispatchEvent(new Event('change'));
    this.editor.detectar();
  }

  emitida(fatoCodigo: string): unknown {
    return this.editor.emitidos.at(-1)?.itens?.find((i) => i.fatoCodigo === fatoCodigo)?.regras
      .restricoes;
  }

  comData(restricoes?: RegrasDoCampo['restricoes']): void {
    this.editor.entrada('catalogo', [fato('A'), data('NASCIMENTO')]);
    this.editor.entrada('conteudo', { ...conteudo, itens: [item('A', 0), nascimento(restricoes)] });
    this.editor.detectar();
  }

  acrescentarFaixa(): void {
    const tipo = this.editor.tela.querySelector('#f-item-NASCIMENTO-restricao');
    this.trocar(tipo as HTMLSelectElement, 'FAIXA_DE_DATA');
    const botoes = [...this.faixaDe('NASCIMENTO').querySelectorAll('button')];
    const acrescentar = botoes.find((b) => b.textContent?.trim() === 'Acrescentar restrição');
    (acrescentar as HTMLButtonElement).click();
    this.editor.detectar();
  }
}
