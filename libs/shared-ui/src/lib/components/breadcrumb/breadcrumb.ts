import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface UiBreadcrumbItem {
  label: string;
  href?: string;
}

@Component({
  selector: 'ui-breadcrumb',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <ol class="breadcrumb__list">
        @for (item of items(); track item.label; let last = $last) {
          <li class="breadcrumb__item">
            @if (!last && item.href) {
              <a class="breadcrumb__link" [href]="item.href">{{ item.label }}</a>
            } @else {
              <span class="breadcrumb__current" [attr.aria-current]="last ? 'page' : null">
                {{ item.label }}
              </span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class BreadcrumbComponent {
  readonly items = input<readonly UiBreadcrumbItem[]>([]);
}
