import { HttpContext } from '@angular/common/http';
import { ChaveDeSubstituicao, comChave, type ApiResult } from '@uniplus/shared-core/http';
import type { Observable } from 'rxjs';

/**
 * Uma chave de idempotência por comando: com a resposta inconclusiva de um, iniciar outro não
 * descarta a chave, e repetir o primeiro reenvia o mesmo comando sob a mesma chave.
 */
export class ChavesPorComando {
  private readonly chaves = new Map<string, ChaveDeSubstituicao>();

  enviar<T>(
    comando: string,
    corpo: unknown,
    chamada: (contexto: HttpContext) => Observable<ApiResult<T>>,
  ): ReturnType<typeof comChave<T>> {
    return comChave(this.chaveDe(comando), corpo, chamada);
  }

  private chaveDe(comando: string): ChaveDeSubstituicao {
    const existente = this.chaves.get(comando);
    if (existente) return existente;
    const nova = new ChaveDeSubstituicao();
    this.chaves.set(comando, nova);
    return nova;
  }
}
