import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormaAceiteCodigo } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
  type UiTagVariant,
} from '@uniplus/shared-ui/components';
import { TermoConsentimentoResumoDto } from '@uniplus/shared-data/configuracao';

/** Variante visual da tag de Forma de aceite. */
const FORMA_ACEITE_VARIANTE: Readonly<Record<FormaAceiteCodigo, UiTagVariant>> = {
  [FormaAceiteCodigo.A_DEFINIR]: 'neutral',
  [FormaAceiteCodigo.REGISTRO_SEM_ENDERECO_IP]: 'info',
  [FormaAceiteCodigo.REGISTRO_COM_ENDERECO_IP]: 'success',
};

@Component({
  selector: 'cfg-termos-consentimento-lista',
  standalone: true,
  imports: [
    RouterLink,
    EmptyStateComponent,
    FilterBarComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
    IconButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './termos-consentimento-lista.component.html',
})
export class TermosConsentimentoListaComponent {
  readonly busca = input.required<string>();
  readonly loading = input.required<boolean>();
  readonly termosFiltrados = input.required<readonly TermoConsentimentoResumoDto[]>();
  readonly prevCursor = input.required<unknown>();
  readonly nextCursor = input.required<unknown>();
  readonly temFiltroAtivo = input.required<boolean>();
  readonly errorMessage = input.required<string | null>();
  readonly buscaAlterada = output<string>();
  readonly limpar = output<void>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();
  protected formaAceiteVariante(token: FormaAceiteCodigo): UiTagVariant {
    return FORMA_ACEITE_VARIANTE[token];
  }
}
