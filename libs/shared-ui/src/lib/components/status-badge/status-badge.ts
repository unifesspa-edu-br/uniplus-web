import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

export type UiStatusBadgeStatus = 'deferido' | 'indeferido' | 'pendente' | 'em-analise' | 'cancelado';

@Component({
  selector: 'ui-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="tag"
      [class.tag--success]="variant() === 'success'"
      [class.tag--warning]="variant() === 'warning'"
      [class.tag--danger]="variant() === 'danger'"
      [class.tag--info]="variant() === 'info'"
      role="status"
    >
      <span class="tag__dot" aria-hidden="true"></span>
      {{ displayLabel() || state() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly state = input.required<UiStatusBadgeStatus>();
  readonly displayLabel = input<string>('');

  readonly variant = computed(() => {
    const classMap: Record<UiStatusBadgeStatus, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
      'deferido': 'success',
      'indeferido': 'danger',
      'pendente': 'warning',
      'em-analise': 'info',
      'cancelado': 'neutral',
    };
    return classMap[this.state()] ?? 'neutral';
  });
}
