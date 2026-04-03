import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private counter = 0;
  private readonly _notifications = signal<Notification[]>([]);
  readonly notifications = this._notifications.asReadonly();

  success(title: string, message: string): void {
    this.add('success', title, message);
  }

  error(title: string, message: string): void {
    this.add('error', title, message);
  }

  warning(title: string, message: string): void {
    this.add('warning', title, message);
  }

  info(title: string, message: string): void {
    this.add('info', title, message);
  }

  dismiss(id: number): void {
    this._notifications.update((items) => items.filter((n) => n.id !== id));
  }

  private add(type: Notification['type'], title: string, message: string): void {
    const id = ++this.counter;
    this._notifications.update((items) => [...items, { id, type, title, message }]);
    setTimeout(() => this.dismiss(id), 5000);
  }
}
