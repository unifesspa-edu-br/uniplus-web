import {
  ElementRef,
  Injector,
  Signal,
  afterNextRender,
  effect,
  inject,
  untracked,
} from '@angular/core';

export interface OpcoesDoFocoDoEnvio {
  /** O formulário está sendo enviado. */
  readonly salvando: Signal<boolean>;
  /** O drawer do formulário está aberto. */
  readonly aberto: Signal<boolean>;
  /** Leva o foco à recusa do endereço, quando é ela que sobra sem campo marcado. */
  readonly focarEndereco?: () => void;
}

export interface FocoDoEnvio {
  /** Depois da renderização, leva o foco ao primeiro campo inválido. */
  focarPrimeiroInvalido(): void;
}

/**
 * Leva o foco ao primeiro campo marcado como inválido dentro de `raiz`, na ordem da tela. O campo
 * de cidade do endereço fica de fora: quem o conduz é a recusa do endereço. Devolve se achou um.
 */
export function focarPrimeiroCampoInvalido(raiz: HTMLElement): boolean {
  const campos = raiz.querySelectorAll<HTMLElement>('[aria-invalid="true"]:not(:disabled)');
  const campo = [...campos].find((item) => item.closest('ui-valor-de-municipio') === null);
  campo?.focus();
  return campo !== undefined;
}

class FocoDoEnvioDaGaveta implements FocoDoEnvio {
  private estavaSalvando = false;

  constructor(
    private readonly raiz: HTMLElement,
    private readonly injector: Injector,
    private readonly opcoes: OpcoesDoFocoDoEnvio,
  ) {}

  /** Depois da renderização, leva o foco ao primeiro campo inválido. */
  focarPrimeiroInvalido(): void {
    afterNextRender(() => this.focarInvalidoOuEndereco(), { injector: this.injector });
  }

  /** Lê o sinal de envio; roda dentro de um `effect`. */
  acompanhar(): void {
    const salvando = this.opcoes.salvando();
    const comecou = !this.estavaSalvando && salvando;
    const terminou = this.estavaSalvando && !salvando;
    this.estavaSalvando = salvando;
    if (comecou && this.focoEstaNosCampos()) {
      afterNextRender(() => this.focarBotaoDeSalvar(), { injector: this.injector });
    }
    if (terminou) {
      afterNextRender(() => this.focarSeAberto(), { injector: this.injector });
    }
  }

  private focarSeAberto(): void {
    if (untracked(this.opcoes.aberto)) {
      this.focarInvalidoOuEndereco();
    }
  }

  private focarInvalidoOuEndereco(): void {
    if (!focarPrimeiroCampoInvalido(this.raiz)) {
      this.opcoes.focarEndereco?.();
    }
  }

  private focoEstaNosCampos(): boolean {
    return this.raiz.querySelector('fieldset')?.contains(document.activeElement) ?? false;
  }

  private focarBotaoDeSalvar(): void {
    this.raiz.querySelector<HTMLElement>('button[type="submit"]')?.focus();
  }
}

/**
 * O foco do formulário em gaveta durante o envio. Ao começar com o foco num campo (Enter, por
 * exemplo), o fieldset desabilita o campo e o foco iria ao `body`: leva-o ao botão de salvar. Ao
 * terminar com a gaveta aberta, vai ao primeiro campo recusado; se a recusa não é de campo, fica
 * no botão. O envio barrado localmente não passa por aqui: o formulário chama
 * `focarPrimeiroInvalido`.
 *
 * Chamar em contexto de injeção, no componente do formulário.
 */
export function acompanharFocoDoEnvio(opcoes: OpcoesDoFocoDoEnvio): FocoDoEnvio {
  const raiz = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const foco = new FocoDoEnvioDaGaveta(raiz, inject(Injector), opcoes);
  effect(() => foco.acompanhar());
  return foco;
}
