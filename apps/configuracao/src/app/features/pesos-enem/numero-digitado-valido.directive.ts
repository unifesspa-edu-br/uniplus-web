import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import { AbstractControl, NG_VALIDATORS, ValidationErrors, Validator } from '@angular/forms';

/**
 * Recusa o texto que o navegador não consegue ler como número num
 * `<input type="number">` (ex.: "4e", "--4").
 *
 * Nesse caso o navegador expõe `value` vazio e marca `validity.badInput`; o
 * `NumberValueAccessor` grava `null` no controle, e um campo opcional (como o corte)
 * passaria a valer "sem corte" sem aviso. O validador devolve `numeroInvalido`, que
 * bloqueia o envio até o operador corrigir.
 *
 * Quando acusar:
 * - **não durante a digitação:** "2," ou "2." são estados intermediários com
 *   `badInput`, e acusá-los faria o alerta disparar a cada separador digitado. Nesse
 *   intervalo o validador devolve `digitacaoIncompleta`: o campo fica inválido (não
 *   se envia texto pela metade), mas a tela não mostra mensagem — nem a de campo
 *   obrigatório, que o valor vazio causaria num campo como o peso;
 * - **ao sair do campo ou ao confirmar com Enter**, e só se o texto for inválido: aí
 *   o controle revalida. Com texto válido não revalida, para não apagar o erro que o
 *   backend gravou no controle antes de o operador editá-lo.
 */
@Directive({
  selector: 'input[type=number][cfgNumeroDigitadoValido]',
  standalone: true,
  providers: [{ provide: NG_VALIDATORS, useExisting: NumeroDigitadoValidoDirective, multi: true }],
})
export class NumeroDigitadoValidoDirective implements Validator {
  private readonly elemento = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private acusar = false;
  private revalidar: (() => void) | null = null;

  validate(_control: AbstractControl): ValidationErrors | null {
    if (!this.textoInvalido()) {
      return null;
    }
    return this.acusar ? { numeroInvalido: true } : { digitacaoIncompleta: true };
  }

  registerOnValidatorChange(fn: () => void): void {
    this.revalidar = fn;
  }

  /** Digitando: nada é acusado até o operador terminar. A revalidação aqui cobre o
   *  caso de o acessor de valor ter validado antes deste ouvinte, com o erro antigo. */
  @HostListener('input')
  protected aoDigitar(): void {
    if (this.acusar) {
      this.acusar = false;
      this.revalidar?.();
    }
  }

  @HostListener('blur')
  @HostListener('keydown.enter')
  protected aoTerminar(): void {
    if (this.textoInvalido()) {
      this.acusar = true;
      this.revalidar?.();
    }
  }

  private textoInvalido(): boolean {
    return this.elemento.nativeElement.validity?.badInput === true;
  }
}
