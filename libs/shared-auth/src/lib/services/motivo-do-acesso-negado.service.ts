import { Injectable, signal } from '@angular/core';

/**
 * Guarda, em memória, o `detail` que a API deu ao recusar com 403, para a página de acesso negado
 * mostrá-lo. Fica só na sessão da aba: recarregar a página ou abrir a rota direto mostra o texto
 * padrão.
 */
@Injectable({ providedIn: 'root' })
export class MotivoDoAcessoNegadoService {
  private readonly _motivo = signal<string | null>(null);

  readonly motivo = this._motivo.asReadonly();

  registrar(detail: unknown): void {
    const texto = typeof detail === 'string' ? detail.trim() : '';
    this._motivo.set(texto ? texto : null);
  }

  limpar(): void {
    this._motivo.set(null);
  }
}
