import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import {
  RESTRICAO_FAIXA_NUMERICA,
  RESTRICAO_MUNICIPIOS_DA_UF,
  RESTRICAO_OPCOES_PERMITIDAS,
  RESTRICAO_TAMANHO_TEXTO,
  RESTRICOES,
  problemaDaRestricao,
  restricaoNova,
  restricaoSoParaLeitura,
  restricoesParaAcrescentar,
  type ItemDoFormulario,
  type RestricaoDeValor,
} from './formulario-editavel';

/**
 * As restrições sobre a resposta de um campo: a faixa do número, o tamanho do texto, as opções
 * permitidas da seleção e a UF de onde vêm os municípios. Cada restrição diz o que falta para ser
 * gravada, como a API conferiria. A restrição que esta tela não declara — opções condicionadas a
 * respostas, opções formadas por respostas — aparece só para leitura e é gravada como veio.
 */
@Component({
  selector: 'ui-restricoes-do-campo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (restricoes().length > 0 || paraAcrescentar().length > 0) {
      <fieldset class="editor-formulario__restricoes">
        <legend class="field__label">Restrições da resposta</legend>

        @for (restricao of restricoes(); track restricao.tipo; let indice = $index) {
          <fieldset class="editor-formulario__restricao" [attr.aria-describedby]="problema(restricao) ? idDe(restricao, 'erro') : null">
            <legend class="field__label">{{ rotuloDoTipo(restricao.tipo) }}</legend>

            @if (soParaLeitura(restricao)) {
              <p class="field__hint">Declarada fora desta tela: não se edita aqui. É mantida como está ao salvar, salvo se for removida.</p>
            } @else {
              @switch (restricao.tipo) {
                @case (faixa) {
                  <div class="editor-formulario__campos">
                    <div class="field">
                      <label class="field__label" [for]="idDe(restricao, 'minimo')">Mínimo</label>
                      <input class="input" type="text" inputmode="decimal" [id]="idDe(restricao, 'minimo')" [value]="restricao.minimo ?? ''" [disabled]="disabled()" (change)="trocarLimite(indice, 'minimo', $event)" />
                    </div>
                    <div class="field">
                      <label class="field__label" [for]="idDe(restricao, 'maximo')">Máximo</label>
                      <input class="input" type="text" inputmode="decimal" [id]="idDe(restricao, 'maximo')" [value]="restricao.maximo ?? ''" [disabled]="disabled()" (change)="trocarLimite(indice, 'maximo', $event)" />
                    </div>
                  </div>
                }
                @case (tamanho) {
                  <div class="editor-formulario__campos">
                    <div class="field">
                      <label class="field__label" [for]="idDe(restricao, 'minimo')">Mínimo de caracteres</label>
                      <input class="input" type="text" inputmode="numeric" [id]="idDe(restricao, 'minimo')" [value]="restricao.minimo ?? ''" [disabled]="disabled()" (change)="trocarLimite(indice, 'minimo', $event)" />
                    </div>
                    <div class="field">
                      <label class="field__label" [for]="idDe(restricao, 'maximo')">Máximo de caracteres</label>
                      <input class="input" type="text" inputmode="numeric" [id]="idDe(restricao, 'maximo')" [value]="restricao.maximo ?? ''" [disabled]="disabled()" (change)="trocarLimite(indice, 'maximo', $event)" />
                    </div>
                  </div>
                }
                @case (opcoes) {
                  <div class="editor-formulario__opcoes" role="group" [attr.aria-label]="'Valores que a resposta pode ter em ' + nome()">
                    @for (valor of valoresConhecidos(); track valor) {
                      <label class="checkbox">
                        <input type="checkbox" [checked]="permitido(restricao, valor)" [disabled]="disabled()" (change)="alternarValor(indice, valor)" />
                        <span class="checkbox__box" aria-hidden="true"></span>
                        {{ valor }}
                      </label>
                    }
                  </div>
                }
                @case (municipios) {
                  <div class="field">
                    <label class="field__label" [for]="idDe(restricao, 'uf')">Campo de UF</label>
                    <select class="select" [id]="idDe(restricao, 'uf')" [disabled]="disabled()" (change)="trocarUf(indice, $event)">
                      <option value="" [selected]="(restricao.fatos ?? []).length === 0">Escolha o campo de UF</option>
                      @for (uf of ufsDaRestricao(restricao); track uf.codigo) {
                        <option [value]="uf.codigo" [selected]="(restricao.fatos ?? [])[0] === uf.codigo">{{ uf.nome }}</option>
                      }
                    </select>
                  </div>
                }
              }
            }

            @if (problema(restricao); as texto) {
              <p class="field__error" [id]="idDe(restricao, 'erro')">{{ texto }}</p>
            }

            @if (restricao.tipo !== municipios) {
              <button class="btn btn--tertiary btn--sm" type="button" [disabled]="disabled()" (click)="remover(indice)">
                Remover a restrição “{{ rotuloDoTipo(restricao.tipo) }}”
              </button>
            }
          </fieldset>
        }

        @if (paraAcrescentar().length > 0) {
          <div class="editor-formulario__acrescentar">
            <div class="field">
              <label class="field__label" [for]="idBase() + '-restricao'">Restrição a acrescentar</label>
              <select class="select" [id]="idBase() + '-restricao'" [disabled]="disabled()" (change)="escolhida.set(valorDe($event))">
                <option value="" [selected]="escolha() === ''">Escolha a restrição</option>
                @for (opcao of paraAcrescentar(); track opcao.valor) {
                  <option [value]="opcao.valor" [selected]="escolha() === opcao.valor">{{ opcao.rotulo }}</option>
                }
              </select>
            </div>
            <button class="btn btn--secondary btn--sm" type="button" [disabled]="disabled() || escolha() === ''" (click)="acrescentar()">
              Acrescentar restrição
            </button>
          </div>
        }
      </fieldset>
    }
  `,
})
export class RestricoesDoCampoComponent {
  readonly item = input.required<ItemDoFormulario>();
  /** Os valores do domínio do próprio fato, quando conhecidos: os que as opções permitidas marcam. */
  readonly valoresConhecidos = input<readonly string[]>([]);
  /** Os campos de UF anteriores, de onde o município pode tirar a lista. */
  readonly ufs = input<readonly { readonly codigo: string; readonly nome: string }[]>([]);
  readonly idBase = input.required<string>();
  readonly disabled = input<boolean>(false);

  readonly restricoesChange = output<readonly RestricaoDeValor[] | null>();

  protected readonly faixa = RESTRICAO_FAIXA_NUMERICA;
  protected readonly tamanho = RESTRICAO_TAMANHO_TEXTO;
  protected readonly opcoes = RESTRICAO_OPCOES_PERMITIDAS;
  protected readonly municipios = RESTRICAO_MUNICIPIOS_DA_UF;
  protected readonly problema = problemaDaRestricao;
  protected readonly soParaLeitura = restricaoSoParaLeitura;

  protected readonly escolhida = signal('');
  protected readonly restricoes = computed(() => this.item().restricoes ?? []);
  protected readonly nome = computed(() => this.item().rotulo.trim() || this.item().fatoCodigo);
  protected readonly paraAcrescentar = computed(() => restricoesParaAcrescentar(this.item(), this.valoresConhecidos().length > 0));
  protected readonly escolha = computed(() =>
    this.paraAcrescentar().some((opcao) => opcao.valor === this.escolhida()) ? this.escolhida() : '',
  );

  protected idDe(restricao: RestricaoDeValor, parte: string): string {
    return `${this.idBase()}-${restricao.tipo}-${parte}`;
  }

  protected rotuloDoTipo(tipo: string): string {
    return RESTRICOES.find((restricao) => restricao.valor === tipo)?.rotulo ?? tipo;
  }

  protected valorDe(evento: Event): string {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected permitido(restricao: RestricaoDeValor, valor: string): boolean {
    return (restricao.entradas ?? [])[0]?.valores.includes(valor) ?? false;
  }

  /** A UF gravada aparece mesmo que não esteja mais antes do município, para não ser trocada sem aviso. */
  protected ufsDaRestricao(restricao: RestricaoDeValor): readonly { readonly codigo: string; readonly nome: string }[] {
    const gravada = (restricao.fatos ?? [])[0];
    return gravada === undefined || this.ufs().some((uf) => uf.codigo === gravada)
      ? this.ufs()
      : [{ codigo: gravada, nome: `${gravada} (não vem antes deste campo)` }, ...this.ufs()];
  }

  /**
   * O limite como número quando é número, e o texto como veio quando não é, para o problema dizer o
   * quê. Converte ao sair do campo: na digitação, o número normalizado sobrescreveria o texto.
   */
  protected trocarLimite(indice: number, limite: 'minimo' | 'maximo', evento: Event): void {
    const texto = this.valorDe(evento).trim().replace(',', '.');
    const valor = texto === '' ? null : Number.isFinite(Number(texto)) ? Number(texto) : texto;
    this.trocar(indice, { [limite]: valor });
  }

  protected alternarValor(indice: number, valor: string): void {
    const atual = (this.restricoes()[indice]?.entradas ?? [])[0]?.valores ?? [];
    const valores = atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor];
    this.trocar(indice, { entradas: [{ quando: null, valores }] });
  }

  protected trocarUf(indice: number, evento: Event): void {
    const uf = this.valorDe(evento);
    this.trocar(indice, { fatos: uf === '' ? [] : [uf] });
  }

  protected acrescentar(): void {
    const tipo = this.escolha();
    if (tipo === '') return;
    this.escolhida.set('');
    this.restricoesChange.emit([...this.restricoes(), restricaoNova(tipo)]);
  }

  protected remover(indice: number): void {
    const restantes = this.restricoes().filter((_, posicao) => posicao !== indice);
    this.restricoesChange.emit(restantes.length === 0 ? null : restantes);
  }

  private trocar(indice: number, mudanca: Partial<RestricaoDeValor>): void {
    this.restricoesChange.emit(this.restricoes().map((restricao, posicao) => (posicao === indice ? { ...restricao, ...mudanca } : restricao)));
  }
}
