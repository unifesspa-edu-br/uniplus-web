import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { type FatoEscolhivel } from '../editor-de-condicoes/condicoes-de-fatos';
import {
  ANCORA_DATA_FIXA,
  ANCORA_ENVIO,
  RESTRICAO_FAIXA_DE_DATA,
  RESTRICAO_FAIXA_NUMERICA,
  RESTRICAO_MUNICIPIOS_DA_UF,
  RESTRICAO_OPCOES_DAS_RESPOSTAS,
  RESTRICAO_OPCOES_PERMITIDAS,
  RESTRICAO_TAMANHO_TEXTO,
  RESTRICOES,
  entradaDeOpcoesNova,
  limiteDeDataNovo,
  problemaDaRestricao,
  problemaDoLimiteDeData,
  recusasDaRestricao,
  recusasDoGrupoDeOpcoes,
  restricaoNova,
  restricoesParaAcrescentar,
  type ItemDoFormulario,
  type LimiteDeDataNoWire,
  type OpcoesCondicionadas,
  type RecusaDaRestricao,
  type RestricaoDeValor,
} from './formulario-editavel';
import { GrupoDeOpcoesComponent } from './grupo-de-opcoes';
import { ValorLegivelDirective } from '../valor-legivel/valor-legivel.directive';

type LimiteDaFaixa = 'dataMinima' | 'dataMaxima';

const LIMITES_DA_FAIXA: readonly { readonly limite: LimiteDaFaixa; readonly rotulo: string }[] = [
  { limite: 'dataMinima', rotulo: 'Data mínima' },
  { limite: 'dataMaxima', rotulo: 'Data máxima' },
];

interface CampoCitavel {
  readonly codigo: string;
  readonly nome: string;
}

/**
 * As restrições sobre a resposta de um campo: a faixa do número, a faixa de datas — cada limite uma
 * data fixa ou o dia do envio deslocado em anos e dias —, o tamanho do texto, as opções
 * permitidas da seleção — em grupos, cada um com a condição sobre respostas anteriores em que vale
 * —, as opções formadas pelas respostas a campos anteriores e a UF de onde vêm os municípios. Cada
 * restrição diz o que falta para ser gravada, como a API conferiria, e mostra a recusa que a aponta.
 */
@Component({
  selector: 'ui-restricoes-do-campo',
  standalone: true,
  imports: [ValorLegivelDirective, GrupoDeOpcoesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (restricoes().length > 0 || paraAcrescentar().length > 0) {
      <fieldset class="editor-formulario__restricoes">
        <legend class="field__label">Restrições da resposta</legend>

        @for (restricao of restricoes(); track restricao.tipo; let indice = $index) {
          <fieldset class="editor-formulario__restricao" [attr.aria-describedby]="descricaoDa(restricao)">
            <legend class="field__label">{{ rotuloDoTipo(restricao.tipo) }}</legend>

            @switch (restricao.tipo) {
              @case (faixa) {
                <div class="form-grid form-grid--pair">
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
              @case (faixaDeData) {
                <p class="field__hint" [id]="idDe(restricao, 'dica')">
                  Cada limite é uma data fixa ou o dia do envio somado a anos e dias; use números negativos para voltar no tempo,
                  como −18 anos para exigir 18 anos completos. Informe ao menos um limite.
                </p>
                <div class="form-grid form-grid--pair">
                  @for (parte of limitesDaFaixa; track parte.limite) {
                    <fieldset class="editor-formulario__limite" [attr.aria-describedby]="descricaoDoLimite(restricao, parte.limite)">
                      <legend class="field__label">{{ parte.rotulo }}</legend>
                      <div class="field">
                        <label class="field__label" [for]="idDe(restricao, parte.limite + '-ancora')">Contado de</label>
                        <select class="select" [id]="idDe(restricao, parte.limite + '-ancora')" [disabled]="disabled()" [attr.aria-describedby]="descricaoDoLimite(restricao, parte.limite)" (change)="trocarAncora(indice, parte.limite, $event)">
                          <option value="" [selected]="limiteDe(restricao, parte.limite) === null">Sem limite</option>
                          <option [value]="dataFixa" [selected]="limiteDe(restricao, parte.limite)?.ancora === dataFixa">Data fixa</option>
                          <option [value]="envio" [selected]="limiteDe(restricao, parte.limite)?.ancora === envio">Dia do envio</option>
                        </select>
                      </div>
                      @if (limiteDe(restricao, parte.limite); as limite) {
                        @if (limite.ancora === dataFixa) {
                          <div class="field">
                            <label class="field__label" [for]="idDe(restricao, parte.limite + '-data')">Data</label>
                            <input class="input" type="date" [id]="idDe(restricao, parte.limite + '-data')" [value]="limite.data ?? ''" [disabled]="disabled()" [attr.aria-invalid]="problemaDoLimite(restricao, parte.limite) ? 'true' : null" [attr.aria-describedby]="descricaoDoLimite(restricao, parte.limite)" (change)="trocarData(indice, parte.limite, $event)" />
                          </div>
                        } @else {
                          <div class="form-grid form-grid--pair">
                            <div class="field">
                              <label class="field__label" [for]="idDe(restricao, parte.limite + '-anos')">Anos a somar ao dia do envio</label>
                              <input class="input" type="text" [id]="idDe(restricao, parte.limite + '-anos')" [value]="limite.anos ?? ''" [disabled]="disabled()" [attr.aria-invalid]="problemaDoLimite(restricao, parte.limite) ? 'true' : null" [attr.aria-describedby]="descricaoDoLimite(restricao, parte.limite)" (change)="trocarDeslocamento(indice, parte.limite, 'anos', $event)" />
                            </div>
                            <div class="field">
                              <label class="field__label" [for]="idDe(restricao, parte.limite + '-dias')">Dias a somar ao dia do envio</label>
                              <input class="input" type="text" [id]="idDe(restricao, parte.limite + '-dias')" [value]="limite.dias ?? ''" [disabled]="disabled()" [attr.aria-invalid]="problemaDoLimite(restricao, parte.limite) ? 'true' : null" [attr.aria-describedby]="descricaoDoLimite(restricao, parte.limite)" (change)="trocarDeslocamento(indice, parte.limite, 'dias', $event)" />
                            </div>
                          </div>
                        }
                      }
                      @if (problemaDoLimite(restricao, parte.limite); as texto) {
                        <p class="field__error" [id]="idDe(restricao, parte.limite + '-erro')">{{ texto }}</p>
                      }
                      @if (parte.limite === 'dataMaxima' && erroNaMaxima(restricao)) {
                        @if (problema(restricao); as texto) {
                          <p class="field__error" [id]="idDe(restricao, 'erro')">{{ texto }}</p>
                        }
                        @if (recusasDaRestricao(restricao).length > 0) {
                          <ul class="editor-formulario__erros" [id]="idDe(restricao, 'recusas')">
                            @for (recusa of recusasDaRestricao(restricao); track $index) {
                              <li class="field__error">{{ recusa }}</li>
                            }
                          </ul>
                        }
                      }
                    </fieldset>
                  }
                </div>
              }
              @case (tamanho) {
                <div class="form-grid form-grid--pair">
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
                <p class="field__hint">
                  O candidato escolhe entre as opções de todos os grupos cuja condição vale. O grupo sem condição vale sempre.
                </p>
                @for (entrada of restricao.entradas ?? []; track $index; let grupo = $index) {
                  <ui-grupo-de-opcoes
                    [entrada]="entrada"
                    [posicao]="grupo + 1"
                    [valoresConhecidos]="valoresConhecidos()"
                    [fatos]="fatos()"
                    [nomeDoCampo]="nome()"
                    [idBase]="idDe(restricao, 'grupo-' + grupo)"
                    [disabled]="disabled()"
                    [removivel]="(restricao.entradas ?? []).length > 1"
                    [recusas]="recusasDoGrupo(entrada)"
                    (entradaChange)="trocarEntrada(indice, grupo, $event)"
                    (remover)="removerEntrada(indice, grupo)"
                  />
                }
                <button class="btn btn--secondary btn--sm" type="button" [disabled]="disabled()" (click)="acrescentarEntrada(indice)">
                  Acrescentar grupo de opções
                </button>
              }
              @case (dasRespostas) {
                <div class="editor-formulario__opcoes" role="group" [attr.aria-label]="'Campos de onde vêm as opções de ' + nome()">
                  @for (fonte of fontesDaRestricao(restricao); track fonte.codigo) {
                    <label class="checkbox">
                      <input type="checkbox" [checked]="(restricao.fatos ?? []).includes(fonte.codigo)" [disabled]="disabled()" (change)="alternarFonte(indice, fonte.codigo)" />
                      <span class="checkbox__box" aria-hidden="true"></span>
                      {{ fonte.nome }}
                    </label>
                  }
                </div>
                <p class="field__hint">O candidato escolhe entre as respostas que deu nos campos marcados.</p>
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

            @if (!erroNaMaxima(restricao) && problema(restricao); as texto) {
              <p class="field__error" [id]="idDe(restricao, 'erro')">{{ texto }}</p>
            }
            @if (!erroNaMaxima(restricao) && recusasDaRestricao(restricao).length > 0) {
              <ul class="editor-formulario__erros" [id]="idDe(restricao, 'recusas')">
                @for (recusa of recusasDaRestricao(restricao); track $index) {
                  <li class="field__error">{{ recusa }}</li>
                }
              </ul>
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
  /** Os fatos que a condição de um grupo de opções pode citar: os anteriores ao campo. */
  readonly fatos = input<readonly FatoEscolhivel[]>([]);
  /** Os campos anteriores de onde as opções podem vir: os de opções que cabem nas do campo. */
  readonly fontesDeOpcoes = input<readonly CampoCitavel[]>([]);
  /** As recusas da API que apontam uma restrição do campo, ou um grupo de opções dela. */
  readonly recusas = input<readonly RecusaDaRestricao[]>([]);
  /** Os campos de UF anteriores, de onde o município pode tirar a lista. */
  readonly ufs = input<readonly CampoCitavel[]>([]);
  readonly idBase = input.required<string>();
  readonly disabled = input<boolean>(false);

  readonly restricoesChange = output<readonly RestricaoDeValor[] | null>();

  protected readonly faixa = RESTRICAO_FAIXA_NUMERICA;
  protected readonly faixaDeData = RESTRICAO_FAIXA_DE_DATA;
  protected readonly limitesDaFaixa = LIMITES_DA_FAIXA;
  protected readonly dataFixa = ANCORA_DATA_FIXA;
  protected readonly envio = ANCORA_ENVIO;
  protected readonly tamanho = RESTRICAO_TAMANHO_TEXTO;
  protected readonly opcoes = RESTRICAO_OPCOES_PERMITIDAS;
  protected readonly dasRespostas = RESTRICAO_OPCOES_DAS_RESPOSTAS;
  protected readonly municipios = RESTRICAO_MUNICIPIOS_DA_UF;
  protected readonly problema = problemaDaRestricao;

  protected readonly escolhida = signal('');
  protected readonly restricoes = computed(() => this.item().restricoes ?? []);
  protected readonly nome = computed(() => this.item().rotulo.trim() || this.item().fatoCodigo);
  protected readonly paraAcrescentar = computed(() =>
    restricoesParaAcrescentar(this.item(), this.valoresConhecidos().length > 0, this.fontesDeOpcoes().length > 0),
  );
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

  protected recusasDaRestricao(restricao: RestricaoDeValor): readonly string[] {
    return recusasDaRestricao(this.recusas(), restricao.tipo);
  }

  /**
   * Onde a API e a conferência local apontam a faixa inteira — a mínima depois da máxima —, o erro fica
   * no controle da data máxima. Sem limite nenhum, não há controle a que ligá-lo: fica na restrição.
   */
  protected erroNaMaxima(restricao: RestricaoDeValor): boolean {
    return restricao.tipo === RESTRICAO_FAIXA_DE_DATA && (restricao.dataMinima != null || restricao.dataMaxima != null);
  }

  protected limiteDe(restricao: RestricaoDeValor, limite: LimiteDaFaixa): LimiteDeDataNoWire | null {
    return restricao[limite] ?? null;
  }

  protected problemaDoLimite(restricao: RestricaoDeValor, limite: LimiteDaFaixa): string | null {
    return problemaDoLimiteDeData(this.limiteDe(restricao, limite));
  }

  /**
   * A dica da faixa e o erro ou a recusa que o controle do limite cita. A API aponta a faixa inteira
   * (`restricoes[i]`), sem dizer o limite: o problema e a recusa da faixa valem para os dois limites.
   */
  protected descricaoDoLimite(restricao: RestricaoDeValor, limite: LimiteDaFaixa): string | null {
    const ids = [
      this.idDe(restricao, 'dica'),
      this.problemaDoLimite(restricao, limite) === null ? null : this.idDe(restricao, limite + '-erro'),
      this.problema(restricao) === null ? null : this.idDe(restricao, 'erro'),
      this.recusasDaRestricao(restricao).length > 0 ? this.idDe(restricao, 'recusas') : null,
    ];
    return ids.filter((id) => id !== null).join(' ');
  }

  protected recusasDoGrupo(grupo: OpcoesCondicionadas): readonly string[] {
    return recusasDoGrupoDeOpcoes(this.recusas(), grupo);
  }

  protected descricaoDa(restricao: RestricaoDeValor): string | null {
    const ids = [
      this.problema(restricao) === null ? null : this.idDe(restricao, 'erro'),
      this.recusasDaRestricao(restricao).length > 0 ? this.idDe(restricao, 'recusas') : null,
    ];
    return ids.filter((id) => id !== null).join(' ') || null;
  }

  /** O campo gravado que não pode mais formar as opções aparece, para ser desmarcado com aviso. */
  protected fontesDaRestricao(restricao: RestricaoDeValor): readonly CampoCitavel[] {
    const oferecidas = new Set(this.fontesDeOpcoes().map((fonte) => fonte.codigo));
    const foraDaLista = (restricao.fatos ?? [])
      .filter((codigo) => !oferecidas.has(codigo))
      .map((codigo) => ({ codigo, nome: `${this.fatos().find((fato) => fato.codigo === codigo)?.nome ?? codigo} (não vem antes deste campo ou tem opções que não cabem nele)` }));
    return [...this.fontesDeOpcoes(), ...foraDaLista];
  }

  /** A UF gravada aparece mesmo que não esteja mais antes do município, para não ser trocada sem aviso. */
  protected ufsDaRestricao(restricao: RestricaoDeValor): readonly CampoCitavel[] {
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

  protected trocarAncora(indice: number, limite: LimiteDaFaixa, evento: Event): void {
    const ancora = this.valorDe(evento);
    this.trocar(indice, { [limite]: ancora === '' ? null : limiteDeDataNovo(ancora) });
  }

  protected trocarData(indice: number, limite: LimiteDaFaixa, evento: Event): void {
    const data = this.valorDe(evento);
    this.trocar(indice, { [limite]: { ancora: ANCORA_DATA_FIXA, data: data === '' ? null : data } });
  }

  /** O deslocamento como número quando é número, e o texto como veio quando não é, para o problema dizer o quê. */
  protected trocarDeslocamento(indice: number, limite: LimiteDaFaixa, parte: 'anos' | 'dias', evento: Event): void {
    const texto = this.valorDe(evento).trim().replace('−', '-');
    const valor = texto === '' ? 0 : Number.isFinite(Number(texto)) ? Number(texto) : texto;
    const atual = this.restricoes()[indice]?.[limite] ?? limiteDeDataNovo(ANCORA_ENVIO);
    this.trocar(indice, { [limite]: { ...atual, ancora: ANCORA_ENVIO, [parte]: valor } });
  }

  protected trocarEntrada(indice: number, grupo: number, entrada: OpcoesCondicionadas): void {
    this.trocar(indice, { entradas: this.entradasDe(indice).map((atual, posicao) => (posicao === grupo ? entrada : atual)) });
  }

  protected acrescentarEntrada(indice: number): void {
    this.trocar(indice, { entradas: [...this.entradasDe(indice), entradaDeOpcoesNova()] });
  }

  protected removerEntrada(indice: number, grupo: number): void {
    this.trocar(indice, { entradas: this.entradasDe(indice).filter((_, posicao) => posicao !== grupo) });
  }

  protected alternarFonte(indice: number, codigo: string): void {
    const atual = this.restricoes()[indice]?.fatos ?? [];
    this.trocar(indice, { fatos: atual.includes(codigo) ? atual.filter((fato) => fato !== codigo) : [...atual, codigo] });
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

  private entradasDe(indice: number): readonly OpcoesCondicionadas[] {
    return this.restricoes()[indice]?.entradas ?? [];
  }

  private trocar(indice: number, mudanca: Partial<RestricaoDeValor>): void {
    this.restricoesChange.emit(this.restricoes().map((restricao, posicao) => (posicao === indice ? { ...restricao, ...mudanca } : restricao)));
  }
}
