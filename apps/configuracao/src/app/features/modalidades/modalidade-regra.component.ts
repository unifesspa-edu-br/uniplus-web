import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import {
  type CatalogoAcompanhado,
  type CondicaoEmClausula,
  EditorDeCondicoesComponent,
  FalhaDeLeituraComponent,
  type FatoEscolhivel,
  IndicadorDaLeituraDirective,
  TODOS_OS_CANDIDATOS,
} from '@uniplus/shared-ui/components';

/** A regra de aplicabilidade: quem concorre na modalidade, lida em prosa e, quando cabe, editável. */
@Component({
  selector: 'cfg-modalidade-regra',
  standalone: true,
  imports: [EditorDeCondicoesComponent, FalhaDeLeituraComponent, IndicadorDaLeituraDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modalidade-regra.component.html',
  styleUrl: '../../shared/formulario/secao-do-formulario.css',
})
export class ModalidadeRegraComponent {
  readonly leituraDoCatalogo = input.required<CatalogoAcompanhado>();
  readonly catalogoCarregado = input.required<boolean>();
  readonly leitura = input.required<readonly string[]>();
  readonly fixadaEmLei = input.required<boolean>();
  readonly condicoes = input.required<readonly CondicaoEmClausula[]>();
  readonly fatos = input.required<readonly FatoEscolhivel[]>();
  readonly errosDasCondicoes = input.required<Readonly<Record<number, string>>>();
  readonly recusas = input.required<readonly string[]>();
  readonly salvando = input.required<boolean>();
  readonly condicoesChange = output<readonly CondicaoEmClausula[]>();

  protected readonly todosOsCandidatos = TODOS_OS_CANDIDATOS;
}
