import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import type { FaseDoCronograma } from '../abas-do-formulario';
import {
  codigoDeFormularioValido,
  LIMITE_DO_CODIGO_DO_FORMULARIO,
} from '../formularios-do-rascunho';
import { modelosQueServem, type ModeloOferecido } from '../modelo-de-formulario';

/** O que o operador escolheu para acrescentar: a fase, o código e o modelo de partida, se houver. */
export interface FormularioAAcrescentar {
  readonly faseCodigo: string;
  readonly codigo: string;
  readonly modelo: ModeloOferecido | null;
}

const CODIGO_INVALIDO =
  'O código começa com letra maiúscula e tem só letras maiúsculas, números e _ (até 60 caracteres).';
const CODIGO_REPETIDO = 'Já existe um formulário com este código.';

/**
 * O pedido para acrescentar um formulário: a fase em que o candidato responde, o código que o
 * identifica — que o modelo escolhido preenche, e o operador pode mudar — e o modelo de partida.
 */
@Component({
  selector: 'sel-acrescimo-de-formulario',
  templateUrl: './acrescimo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class AcrescimoDeFormularioComponent {
  protected readonly store = inject(ProcessoSeletivoStore);

  /** As fases do cronograma que ainda têm lugar para um formulário. */
  readonly fases = input.required<readonly FaseDoCronograma[]>();
  readonly modelos = input.required<readonly ModeloOferecido[]>();
  readonly codigosEmUso = input.required<readonly string[]>();

  readonly acrescentou = output<FormularioAAcrescentar>();

  protected readonly limite = LIMITE_DO_CODIGO_DO_FORMULARIO;
  protected readonly faseEscolhida = signal('');
  protected readonly codigo = signal('');
  protected readonly modeloEscolhido = signal('');

  /** Os modelos que servem à fase escolhida; todos, enquanto ela não é escolhida. */
  protected readonly modelosOferecidos = computed(() =>
    modelosQueServem(
      this.modelos(),
      this.fases().find((fase) => fase.codigo === this.faseEscolhida()),
    ),
  );

  protected readonly erroDoCodigo = computed(() => {
    const codigo = this.codigo();
    if (codigo === '') return null;
    if (!codigoDeFormularioValido(codigo)) return CODIGO_INVALIDO;
    return this.codigosEmUso().includes(codigo) ? CODIGO_REPETIDO : null;
  });

  protected readonly completo = computed(
    () =>
      this.faseEscolhida() !== '' &&
      this.codigo() !== '' &&
      this.erroDoCodigo() === null &&
      this.store.aceitaEdicao(),
  );

  protected escolherFase(codigo: string): void {
    this.faseEscolhida.set(codigo);
    if (!this.modelosOferecidos().some((modelo) => modelo.id === this.modeloEscolhido())) {
      this.modeloEscolhido.set('');
    }
  }

  protected escolherModelo(id: string): void {
    const anterior = this.modelos().find((modelo) => modelo.id === this.modeloEscolhido());
    const modelo = this.modelos().find((item) => item.id === id);
    this.modeloEscolhido.set(id);
    if (modelo !== undefined && (this.codigo() === '' || this.codigo() === anterior?.codigo)) {
      this.codigo.set(modelo.codigo);
    }
  }

  protected digitar(evento: Event): void {
    this.codigo.set((evento.target as HTMLInputElement).value.toLocaleUpperCase('pt-BR'));
  }

  protected acrescentar(): void {
    if (!this.completo()) return;
    this.acrescentou.emit({
      faseCodigo: this.faseEscolhida(),
      codigo: this.codigo(),
      modelo:
        this.modelosOferecidos().find((modelo) => modelo.id === this.modeloEscolhido()) ?? null,
    });
    this.faseEscolhida.set('');
    this.codigo.set('');
    this.modeloEscolhido.set('');
  }
}
