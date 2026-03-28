import { Directive, ElementRef, HostListener, inject } from '@angular/core';

@Directive({
  selector: '[uiCpfMask]',
  standalone: true,
})
export class CpfMaskDirective {
  private readonly el = inject(ElementRef<HTMLInputElement>);

  @HostListener('input', ['$event'])
  onInput(_event: Event): void {
    const input = this.el.nativeElement;
    let value = input.value.replace(/\D/g, '').substring(0, 11);

    if (value.length > 9) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
    } else if (value.length > 6) {
      value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
    } else if (value.length > 3) {
      value = `${value.slice(0, 3)}.${value.slice(3)}`;
    }

    input.value = value;
  }
}
