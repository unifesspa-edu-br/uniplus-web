import { Directive, input, TemplateRef, ViewContainerRef, effect, inject } from '@angular/core';

@Directive({
  selector: '[uiRole]',
  standalone: true,
})
export class RoleDirective {
  private templateRef = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);

  readonly uiRole = input.required<string[]>();
  readonly uiRoleCurrent = input<string[]>([]);

  private hasView = false;

  constructor() {
    effect(() => {
      const required = this.uiRole();
      const current = this.uiRoleCurrent();
      const hasRole = required.some((role) => current.includes(role));

      if (hasRole && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!hasRole && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}
