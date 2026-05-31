import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'ui-institutional-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="institutional-bar" role="region" aria-label="Identificação institucional">
      <span class="institutional-bar__brand">gov.br</span>
      <span class="institutional-bar__sep" aria-hidden="true">|</span>
      <span class="institutional-bar__org">{{ organization() }}</span>
      @if (hasLinks()) {
        <span class="institutional-bar__links">
          @if (siteMapHref(); as href) {
            <a [href]="href">Mapa do site</a>
          }
          @if (accessibilityHref(); as href) {
            <a [href]="href">Acessibilidade</a>
          }
          @if (privacyHref(); as href) {
            <a [href]="href">Privacidade</a>
          }
        </span>
      }
    </div>
  `,
})
export class InstitutionalBarComponent {
  readonly organization = input<string>('UNIFESSPA · Sistema Uni+');
  readonly siteMapHref = input<string | null>(null);
  readonly accessibilityHref = input<string | null>(null);
  readonly privacyHref = input<string | null>(null);

  protected readonly hasLinks = computed(
    () => Boolean(this.siteMapHref() || this.accessibilityHref() || this.privacyHref()),
  );
}
