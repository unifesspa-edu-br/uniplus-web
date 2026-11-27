import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { ValorEmConsultaComponent } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogoDasConsequenciasDeIndeferimento } from '../../cronograma/catalogos/catalogo-das-consequencias-de-indeferimento.service';
import type { AbaDoFormulario } from '../abas-do-formulario';
import {
  codigoDeFormularioValido,
  LIMITE_DO_CODIGO_DO_FORMULARIO,
} from '../formularios-do-rascunho';

const CODIGO_INVALIDO =
  'O código começa com letra maiúscula e tem só letras maiúsculas, números e _ (até 60 caracteres).';
const CODIGO_REPETIDO = 'Já existe um formulário com este código.';

/**
 * O cabeçalho do formulário: o código que o identifica, a fase em que o candidato responde, se ele
 * é obrigado a enviá-lo e o que acontece quando não envia. A fase decide o que cabe ao operador
 * escolher: o formulário da inscrição é sempre obrigatório, e o pedido de isenção, facultativo.
 */
@Component({
  selector: 'sel-cabecalho-do-formulario',
  imports: [ValorEmConsultaComponent],
  templateUrl: './cabecalho.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class CabecalhoDoFormularioComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly consequencias = inject(CatalogoDasConsequenciasDeIndeferimento);

  readonly aba = input.required<AbaDoFormulario>();
  /** Os códigos dos outros formulários do processo: o código é único. */
  readonly codigosEmUso = input.required<readonly string[]>();

  readonly codigoMudou = output<string>();
  readonly faseMudou = output<string>();
  readonly obrigatorioMudou = output<boolean>();
  readonly consequenciaMudou = output<string | null>();

  protected readonly limite = LIMITE_DO_CODIGO_DO_FORMULARIO;

  /** O que está digitado no código: só vale para o formulário quando passa na conferência. */
  protected readonly texto = linkedSignal(() => this.aba().codigo);

  protected readonly erroDoCodigo = computed(() => {
    const texto = this.texto();
    if (!codigoDeFormularioValido(texto)) return CODIGO_INVALIDO;
    return this.codigosEmUso().includes(texto) ? CODIGO_REPETIDO : null;
  });

  protected readonly rotuloDaConsequencia = computed(
    () =>
      this.consequencias
        .consequencias()
        .find((opcao) => opcao.codigo === this.aba().consequenciaDaFaltaDeEnvio)?.rotulo ?? null,
  );

  protected digitar(evento: Event): void {
    this.texto.set((evento.target as HTMLInputElement).value.toLocaleUpperCase('pt-BR'));
  }

  /** O código só muda quando passa na conferência; senão, o campo volta ao que vale. */
  protected confirmarCodigo(): void {
    if (this.erroDoCodigo() === null && this.texto() !== this.aba().codigo) {
      this.codigoMudou.emit(this.texto());
      return;
    }
    this.texto.set(this.aba().codigo);
  }
}
