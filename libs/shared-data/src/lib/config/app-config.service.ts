import { Injectable, signal } from '@angular/core';
import type { AppConfig } from './app-config.model';

/**
 * Hospeda a `AppConfig` resolvida em runtime (ADR-0021). Populada uma
 * única vez pelo `provideAppInitializer` registrado em
 * `provideRuntimeConfig()` antes do bootstrap das rotas.
 *
 * `get()` lança se chamada antes do load — comportamento intencional
 * para tornar a ordem de bootstrap visível ao desenvolvedor (vs. retornar
 * `null` e exigir `?.` em todos os call sites).
 *
 * Em testes, prover via `{ provide: AppConfigService, useValue: stub }`
 * ou popular diretamente com `service.load(config)` no `beforeEach`.
 */
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly _config = signal<AppConfig | null>(null);

  readonly config = this._config.asReadonly();

  load(cfg: AppConfig): void {
    this._config.set(cfg);
  }

  get(): AppConfig {
    const cfg = this._config();
    if (!cfg) {
      throw new Error(
        'AppConfigService.get() chamado antes do runtime-config carregar. ' +
          'Verifique que provideRuntimeConfig() está em app.config.ts antes ' +
          'de qualquer consumidor (provideAuth, BASE_PATHs, etc.).',
      );
    }
    return cfg;
  }
}
