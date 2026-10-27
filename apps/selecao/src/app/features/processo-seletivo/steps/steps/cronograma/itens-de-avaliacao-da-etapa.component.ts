import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';
import type { FormGroup } from '@angular/forms';

import type {
  ItemDeAvaliacaoDaEtapa,
  NivelDeAtendimentoDaEtapa,
} from '../../processo-seletivo.models';
import { FORMA_HUMANA } from '../../shared/forma-de-avaliacao';
import {
  ESCALA_SUGERIDA,
  somaForaDaNotaMaxima,
  textoDaSoma,
} from '../../shared/itens-de-avaliacao';
import type { CampoComRecusa } from './cronograma-do-certame';
import type { EtapaForm } from './cronograma-form';

/**
 * Os itens de avaliação da etapa (critérios ou blocos em que a nota se divide) e, na avaliação
 * humana, a escala de atendimento entre cujos níveis a banca escolhe em cada item.
 *
 * Edita os controles da etapa direto, como o resto do cronograma: a gravação substitui as duas
 * listas inteiras, então elas viajam como valor. O `id` do item que veio da API acompanha o item
 * em toda edição, porque ele é congelado e reutilizado na retificação.
 */
@Component({
  selector: 'sel-itens-de-avaliacao-da-etapa',
  templateUrl: './itens-de-avaliacao-da-etapa.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItensDeAvaliacaoDaEtapaComponent {
  private readonly injector = inject(Injector);

  readonly grupo = input.required<FormGroup<EtapaForm>>();
  readonly posicao = input.required<number>();
  readonly habilitado = input(true);
  /** As recusas do servidor à etapa, por campo; aqui só se lê as dos itens e da escala. */
  readonly recusas = input<ReadonlyMap<CampoComRecusa, string>>(new Map());

  /** O formulário não é sinal: ele avisa por `valueChanges`, e este contador faz os `computed` relerem. */
  private readonly versao = signal(0);

  constructor() {
    effect((aoLimpar) => {
      const assinatura = this.grupo().valueChanges.subscribe(() =>
        this.versao.update((atual) => atual + 1),
      );
      aoLimpar(() => assinatura.unsubscribe());
    });
  }

  readonly itens = computed(() => {
    this.versao();
    return this.grupo().controls.itensDeAvaliacao.value;
  });

  readonly escala = computed(() => {
    this.versao();
    return this.grupo().controls.escalaDeAtendimento.value;
  });

  /** A escala só existe na avaliação humana e onde há itens a atender. */
  readonly admiteEscala = computed(() => {
    this.versao();
    return this.grupo().controls.formaDeAvaliacao.value === FORMA_HUMANA && this.itens().length > 0;
  });

  readonly soma = computed(() => {
    this.versao();
    return this.itens().length === 0
      ? ''
      : textoDaSoma(this.itens(), this.grupo().controls.notaMaxima.value);
  });

  readonly somaForaDaNotaMaxima = computed(() => {
    this.versao();
    return somaForaDaNotaMaxima(this.itens(), this.grupo().controls.notaMaxima.value);
  });

  readonly sufixo = computed(() => `cr-etapa-${this.posicao()}`);

  recusaDaLista(campo: 'itensDeAvaliacao' | 'escalaDeAtendimento'): string | null {
    return this.recusas().get(campo) ?? null;
  }

  recusaDoItem(indice: number, campo: 'rotulo' | 'pontuacaoMaxima'): string | null {
    return this.recusas().get(`itensDeAvaliacao.${indice}.${campo}`) ?? null;
  }

  recusaDoNivel(indice: number, campo: 'rotulo' | 'fracao'): string | null {
    return this.recusas().get(`escalaDeAtendimento.${indice}.${campo}`) ?? null;
  }

  /** O nome do item para quem não o vê: o rótulo, ou a posição enquanto ele não tem rótulo. */
  nomeDoItem(item: ItemDeAvaliacaoDaEtapa, indice: number): string {
    const rotulo = item.rotulo.trim();
    return rotulo === '' ? `Item ${indice + 1}` : rotulo;
  }

  nomeDoNivel(nivel: NivelDeAtendimentoDaEtapa, indice: number): string {
    const rotulo = nivel.rotulo.trim();
    return rotulo === '' ? `Nível ${indice + 1}` : rotulo;
  }

  acrescentarItem(): void {
    const itens = this.itens();
    this.gravarItens([...itens, { id: null, rotulo: '', pontuacaoMaxima: '' }]);
    this.focar(`${this.sufixo()}-item-${itens.length}-rotulo`);
  }

  editarItem(indice: number, parcial: Partial<ItemDeAvaliacaoDaEtapa>): void {
    this.gravarItens(
      this.itens().map((item, i) => (i === indice ? { ...item, ...parcial } : item)),
    );
  }

  removerItem(indice: number): void {
    const restantes = this.itens().filter((_, i) => i !== indice);
    this.gravarItens(restantes);
    // Sem itens a escala deixa de ter o que atender, e o servidor a recusaria.
    if (restantes.length === 0 && this.escala().length > 0) this.gravarEscala([]);
    this.focar(`${this.sufixo()}-item-acrescentar`);
  }

  acrescentarNivel(): void {
    const niveis = this.escala();
    this.gravarEscala([...niveis, { rotulo: '', percentual: '' }]);
    this.focar(`${this.sufixo()}-nivel-${niveis.length}-rotulo`);
  }

  editarNivel(indice: number, parcial: Partial<NivelDeAtendimentoDaEtapa>): void {
    this.gravarEscala(
      this.escala().map((nivel, i) => (i === indice ? { ...nivel, ...parcial } : nivel)),
    );
  }

  removerNivel(indice: number): void {
    this.gravarEscala(this.escala().filter((_, i) => i !== indice));
    this.focar(`${this.sufixo()}-nivel-acrescentar`);
  }

  usarEscalaSugerida(): void {
    this.gravarEscala(ESCALA_SUGERIDA);
    this.focar(`${this.sufixo()}-nivel-acrescentar`);
  }

  /** O valor do campo de texto que disparou o evento. */
  textoDe(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }

  private gravarItens(itens: readonly ItemDeAvaliacaoDaEtapa[]): void {
    const controle = this.grupo().controls.itensDeAvaliacao;
    controle.setValue(itens);
    controle.markAsDirty();
  }

  /** Com escala a banca escolhe o nível em vez de digitar a nota, então o passo do lançamento sai. */
  private gravarEscala(niveis: readonly NivelDeAtendimentoDaEtapa[]): void {
    const grupo = this.grupo();
    if (niveis.length > 0) grupo.controls.passoDoLancamento.setValue('');
    grupo.controls.escalaDeAtendimento.setValue(niveis);
    grupo.controls.escalaDeAtendimento.markAsDirty();
  }

  private focar(id: string): void {
    afterNextRender(() => document.getElementById(id)?.focus(), { injector: this.injector });
  }
}
