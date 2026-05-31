import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-skip-link',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<a class="skip-link" [href]="'#' + targetId()">{{ linkText() }}</a>`,
})
export class SkipLinkComponent {
  readonly targetId = input<string>('main-content');
  readonly linkText = input<string>('Ir para o conteúdo principal');
}
