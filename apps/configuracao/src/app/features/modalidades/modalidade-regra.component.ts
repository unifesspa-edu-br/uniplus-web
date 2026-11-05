import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  AlertComponent,
  EditorDeCondicoesComponent,
  TODOS_OS_CANDIDATOS,
  type CondicaoEmClausula,
  type FatoEscolhivel,
} from '@uniplus/shared-ui/components';

import type { EstadoDoCatalogo } from './edicao-da-regra-de-aplicabilidade';

/** A regra de aplicabilidade: quem concorre na modalidade, lida em prosa e, quando cabe, editável. */
@Component({
  selector: 'cfg-modalidade-regra',
  standalone: true,
  imports: [AlertComponent, EditorDeCondicoesComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modalidade-regra.component.html',
  styleUrl: '../../shared/formulario/secao-do-formulario.css',
})
export class ModalidadeRegraComponent {
  readonly estadoDoCatalogo = input.required<EstadoDoCatalogo>();
  readonly leitura = input.required<readonly string[]>();
  readonly fixadaEmLei = input.required<boolean>();
  readonly condicoes = input.required<readonly CondicaoEmClausula[]>();
  readonly fatos = input.required<readonly FatoEscolhivel[]>();
  readonly errosDasCondicoes = input.required<Readonly<Record<number, string>>>();
  readonly recusas = input.required<readonly string[]>();
  readonly salvando = input.required<boolean>();
  readonly condicoesChange = output<readonly CondicaoEmClausula[]>();
  readonly recarregarCatalogo = output<void>();

  protected readonly todosOsCandidatos = TODOS_OS_CANDIDATOS;
}
