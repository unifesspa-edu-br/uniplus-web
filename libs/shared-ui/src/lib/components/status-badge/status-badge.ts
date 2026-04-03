import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatusType = 'deferido' | 'indeferido' | 'pendente' | 'em-analise' | 'cancelado';

@Component({
  selector: 'ui-status-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      [ngClass]="badgeClasses()"
      role="status"
    >
      {{ label() || status() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<StatusType>();
  readonly label = input<string>('');

  readonly badgeClasses = computed(() => {
    const classMap: Record<StatusType, string> = {
      'deferido': 'bg-green-100 text-green-800',
      'indeferido': 'bg-red-100 text-red-800',
      'pendente': 'bg-yellow-100 text-yellow-800',
      'em-analise': 'bg-blue-100 text-blue-800',
      'cancelado': 'bg-gray-100 text-gray-800',
    };
    return classMap[this.status()] || 'bg-gray-100 text-gray-800';
  });
}
