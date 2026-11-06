import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FORMAS_ACEITE } from '@uniplus/shared-data/configuracao';
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

/** Rótulo legível de um token de domínio fechado (fallback: o próprio token). */
function rotulo(roster: readonly { value: string; label: string }[], token: string): string {
  return roster.find((o) => o.value === token)?.label ?? token;
}

/** Variante visual da tag de Forma de aceite. */
const FORMA_ACEITE_VARIANTE: Readonly<Record<string, UiTagVariant>> = {
  A_DEFINIR: 'neutral',
  REGISTRO_DIGITAL_SEM_LOG_IP: 'info',
  REGISTRO_DIGITAL_COM_LOG_IP: 'success',
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
  protected formaAceiteLabel(token: string): string {
    return rotulo(FORMAS_ACEITE, token);
  }
  protected formaAceiteVariante(token: string): UiTagVariant {
    return FORMA_ACEITE_VARIANTE[token] ?? 'neutral';
  }
}
