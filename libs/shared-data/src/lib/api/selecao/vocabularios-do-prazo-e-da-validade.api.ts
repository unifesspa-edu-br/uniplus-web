import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import { rotasDoProcesso } from './rotas-do-processo';
import { SELECAO_BASE_PATH } from './tokens';
import type { OpcoesDoVocabulario } from './vocabularios-da-comprovacao.api';

@Injectable({ providedIn: 'root' })
export class VocabulariosDoPrazoEDaValidadeApi {
  private readonly http = inject(HttpClient);
  private readonly rotas = rotasDoProcesso(inject(SELECAO_BASE_PATH));

  listarEscolhasDoPrazoDeEmissao(): Observable<ApiResult<OpcoesDoVocabulario>> {
    return this.http.get<ApiResult<OpcoesDoVocabulario>>(
      this.rotas.doVocabulario('escolhas-prazo-emissao'),
      { context: withVendorMime('escolha-prazo-emissao', 1) },
    );
  }

  listarEscolhasDaValidade(): Observable<ApiResult<OpcoesDoVocabulario>> {
    return this.http.get<ApiResult<OpcoesDoVocabulario>>(
      this.rotas.doVocabulario('escolhas-validade'),
      { context: withVendorMime('escolha-validade', 1) },
    );
  }

  listarUnidadesDoPrazoDeEmissao(): Observable<ApiResult<OpcoesDoVocabulario>> {
    return this.http.get<ApiResult<OpcoesDoVocabulario>>(
      this.rotas.doVocabulario('unidades-prazo-emissao'),
      { context: withVendorMime('unidade-prazo-emissao', 1) },
    );
  }

  listarTiposDaDataDeReferencia(): Observable<ApiResult<OpcoesDoVocabulario>> {
    return this.http.get<ApiResult<OpcoesDoVocabulario>>(
      this.rotas.doVocabulario('tipos-data-referencia'),
      { context: withVendorMime('tipo-data-referencia', 1) },
    );
  }

  listarEfeitosNaAnaliseDoDocumento(): Observable<ApiResult<OpcoesDoVocabulario>> {
    return this.http.get<ApiResult<OpcoesDoVocabulario>>(
      this.rotas.doVocabulario('efeitos-analise-documento'),
      { context: withVendorMime('efeito-analise-documento', 1) },
    );
  }
}
