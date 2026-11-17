import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  output,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { RegraCatalogoDto } from '@uniplus/shared-data/selecao';
import {
  ButtonComponent,
  RecusaDoCampoComponent,
  type RecusaDoCampo,
} from '@uniplus/shared-ui/components';

import type { RegraEscolhida } from '../../../documento/regra-escolhida';
import { chaveDaRegra, regrasEscolhiveis } from '../../classificacao/regra-escolhivel';
import type { LinhaDoProcedimento } from './procedimentos-na-tela';

/**
 * O seletor da regra de uma linha do procedimento: só as regras do catálogo, mais a já declarada
 * quando o catálogo deixou de tê-la. Só apresenta: a escolha e a remoção saem como eventos, e o
 * seletor volta ao que o documento guarda mesmo que quem o usa não atenda o pedido. A linha que só
 * se remove mantém o seletor desabilitado e a remoção disponível.
 */
@Component({
  selector: 'sel-escolha-do-procedimento',
  imports: [ReactiveFormsModule, ButtonComponent, RecusaDoCampoComponent],
  templateUrl: './escolha-do-procedimento.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .escolha {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }
    .escolha select {
      flex: 1 1 16rem;
      min-width: 0;
    }
  `,
})
export class EscolhaDoProcedimentoComponent {
  private readonly injector = inject(Injector);

  readonly idBase = input.required<string>();
  readonly linha = input.required<LinhaDoProcedimento>();
  readonly regrasDoCatalogo = input.required<readonly RegraCatalogoDto[]>();
  /** O tipo de decisão da linha, para o nome acessível do botão de remover. */
  readonly nomeDoTipo = input.required<string>();
  /** Bloqueia a escolha e a remoção, como na seção bloqueada. */
  readonly desabilitado = input(false);
  readonly somenteRemocao = input(false);
  /** O `id` do aviso do tipo de decisão que também descreve este seletor, quando ele existe. */
  readonly idDoAvisoDoTipo = input<string | null>(null);
  readonly emConsulta = input(false);
  readonly sugestao = input<RegraEscolhida | null>(null);
  protected readonly escolha = new FormControl('', { nonNullable: true });
  readonly recusas = input<readonly RecusaDoCampo[]>([]);

  readonly escolher = output<RegraEscolhida>();
  readonly remover = output();

  private readonly declarado = computed(() => this.linha().declarado);
  protected readonly opcoes = computed(() =>
    regrasEscolhiveis(
      this.regrasDoCatalogo(),
      this.declarado()?.regra.codigo ?? '',
      this.declarado()?.regra.versao ?? '',
    ),
  );
  private readonly chaveEscolhida = computed(
    () => this.opcoes().find((opcao) => opcao.selecionada)?.chave ?? '',
  );
  protected readonly sugestaoEmTexto = computed(() => {
    const sugerida = this.declarado() === null ? this.sugestao() : null;
    return (
      this.opcoes().find(
        (opcao) => opcao.codigo === sugerida?.codigo && opcao.versao === sugerida.versao,
      )?.rotulo ?? null
    );
  });
  protected readonly regraParaLeitura = computed(
    () => this.opcoes().find((opcao) => opcao.selecionada)?.rotulo ?? 'Procedimento não declarado',
  );
  /** A linha que só se remove não troca de regra: o seletor fica parado e o Remover segue ativo. */
  protected readonly seletorDesabilitado = computed(
    () =>
      this.desabilitado() || this.somenteRemocao() || this.emConsulta() || this.linha().soRemove,
  );
  protected readonly avisoDeIndisponibilidade = computed(() => {
    const { alvo, alvoInexistente } = this.linha();
    if (!alvoInexistente)
      return 'Há um procedimento para a decisão inteira e procedimentos por item contestado. Mantenha o procedimento da decisão inteira ou os procedimentos por item e remova os demais.';
    return alvo !== null && 'areaDoEnem' in alvo
      ? 'A área do ENEM contestada não existe mais nesta etapa. Remova o procedimento.'
      : 'O item contestado não existe mais nesta etapa. Remova o procedimento.';
  });
  protected readonly comRecusa = computed(() => this.recusas().length > 0);
  protected readonly contextoDaRemocao = computed(() => {
    const { alvo, rotulo } = this.linha();
    return alvo === null ? this.nomeDoTipo() : `${this.nomeDoTipo()}, ${rotulo}`;
  });

  constructor() {
    effect(() => {
      this.escolha.setValue(this.chaveEscolhida(), { emitEvent: false });
      if (this.seletorDesabilitado()) this.escolha.disable({ emitEvent: false });
      else this.escolha.enable({ emitEvent: false });
    });
  }

  protected descritoPor(): string | null {
    const ids = [
      this.idDoAvisoDoTipo(),
      this.linha().foraDoOferecido ? this.id('fora') : null,
      this.linha().ocorrencia > 0 ? this.id('repetido') : null,
      this.sugestaoEmTexto() === null ? null : this.id('sugestao'),
      this.comRecusa() ? this.id('recusa') : null,
    ].filter((id) => id !== null);
    return ids.length === 0 ? null : ids.join(' ');
  }

  protected id(parte: string): string {
    return `${this.idBase()}-${parte}`;
  }

  protected escolhida(seletor: HTMLSelectElement): void {
    const opcao = this.seletorDesabilitado()
      ? undefined
      : this.regrasDoCatalogo().find(
          (regra) => chaveDaRegra(regra.codigo, regra.versao) === seletor.value,
        );
    if (opcao !== undefined) {
      this.escolher.emit({ codigo: opcao.codigo, versao: opcao.versao });
    }
    this.restaurarEscolha(seletor);
  }

  private restaurarEscolha(seletor: HTMLSelectElement): void {
    afterNextRender(
      () => {
        this.escolha.setValue(this.chaveEscolhida(), { emitEvent: false });
        seletor.value = this.chaveEscolhida();
      },
      { injector: this.injector },
    );
  }
}
