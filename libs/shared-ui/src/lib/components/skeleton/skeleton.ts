import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="skeleton"
      [class.skeleton--text]="skeletonKind() === 'text'"
      [class.skeleton--title]="skeletonKind() === 'title'"
      [class.skeleton--circle]="skeletonKind() === 'circle'"
      [class.skeleton--card]="skeletonKind() === 'card'"
      [style.width]="inlineSize()"
      [style.height]="blockSize()"
      aria-hidden="true"
    ></span>
  `,
})
export class SkeletonComponent {
  readonly skeletonKind = input<'text' | 'title' | 'circle' | 'card'>('text');
  readonly inlineSize = input<string | null>(null);
  readonly blockSize = input<string | null>(null);
}
