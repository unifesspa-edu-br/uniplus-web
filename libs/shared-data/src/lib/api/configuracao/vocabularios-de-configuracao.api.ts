import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { type ApiResult, withVendorMime } from '@uniplus/shared-core/http';
import type { components } from './schema';
import { CONFIGURACAO_BASE_PATH } from './tokens';

export type TipoDoDado = components['schemas']['TipoDoDado'];
export type QuantidadeDeValores = components['schemas']['QuantidadeDeValores'];
export type OrigemFato = components['schemas']['OrigemFato'];
export type FonteValoresFato = components['schemas']['FonteValoresFato'];
export type FormatoTexto = components['schemas']['FormatoTexto'];
export type EscopoFato = components['schemas']['EscopoFato'];
export type ComponenteDeExibicao = components['schemas']['ComponenteDeExibicao'];
export type HipoteseLegalTratamento = components['schemas']['HipoteseLegalTratamento'];

export interface VocabulariosDeConfiguracao {
  readonly 'tipos-do-dado': TipoDoDado;
  readonly 'quantidades-de-valores': QuantidadeDeValores;
  readonly 'origens-fato': OrigemFato;
  readonly 'fontes-valores-fato': FonteValoresFato;
  readonly 'formatos-texto': FormatoTexto;
  readonly 'escopos-fato': EscopoFato;
  readonly 'componentes-de-exibicao': ComponenteDeExibicao;
  readonly 'hipoteses-legais-tratamento': HipoteseLegalTratamento;
  readonly 'abrangencias-dia-nao-util': components['schemas']['Abrangencia'];
  readonly 'acoes-quando-indeferido': components['schemas']['AcaoQuandoIndeferido'];
  readonly 'composicoes-vagas': components['schemas']['ComposicaoVagas'];
  readonly 'formas-aceite': components['schemas']['FormaAceite'];
  readonly 'formatos-pedagogicos': components['schemas']['FormatoPedagogico'];
  readonly 'naturezas-legais': components['schemas']['NaturezaLegal'];
  readonly 'origens-data-fase': components['schemas']['OrigemDataFase'];
  readonly 'regras-remanejamento': components['schemas']['RegraRemanejamento'];
  readonly 'tipos-local-oferta': components['schemas']['TipoLocalOferta'];
  readonly 'programas-oferta': components['schemas']['ProgramaDeOferta'];
  readonly 'regimes-funcionamento': components['schemas']['RegimeDeFuncionamento'];
  readonly 'regimes-turno': components['schemas']['RegimeDeTurno'];
  readonly 'turnos-oferta': components['schemas']['TurnoOferta'];
}

const MIME: Readonly<Record<keyof VocabulariosDeConfiguracao, string>> = {
  'tipos-do-dado': 'tipo-do-dado',
  'quantidades-de-valores': 'quantidade-de-valores',
  'origens-fato': 'origem-fato',
  'fontes-valores-fato': 'fonte-valores-fato',
  'formatos-texto': 'formato-texto',
  'escopos-fato': 'escopo-fato',
  'componentes-de-exibicao': 'componente-de-exibicao',
  'hipoteses-legais-tratamento': 'hipotese-legal-tratamento',
  'abrangencias-dia-nao-util': 'codigo-abrangencia-dia-nao-util',
  'acoes-quando-indeferido': 'codigo-acao-quando-indeferido',
  'composicoes-vagas': 'codigo-composicao-vagas',
  'formas-aceite': 'codigo-forma-aceite',
  'formatos-pedagogicos': 'codigo-formato-pedagogico',
  'naturezas-legais': 'codigo-natureza-legal',
  'origens-data-fase': 'codigo-origem-data-fase',
  'regras-remanejamento': 'codigo-regra-remanejamento',
  'tipos-local-oferta': 'codigo-tipo-local-oferta',
  'programas-oferta': 'codigo-programa-de-oferta',
  'regimes-funcionamento': 'codigo-regime-de-funcionamento',
  'regimes-turno': 'codigo-regime-de-turno',
  'turnos-oferta': 'codigo-turno-oferta',
};

@Injectable({ providedIn: 'root' })
export class VocabulariosDeConfiguracaoApi {
  private readonly http = inject(HttpClient);
  private readonly basePath = inject(CONFIGURACAO_BASE_PATH);

  listar<K extends keyof VocabulariosDeConfiguracao>(
    vocabulario: K,
  ): Observable<ApiResult<readonly VocabulariosDeConfiguracao[K][]>> {
    return this.http.get<ApiResult<readonly VocabulariosDeConfiguracao[K][]>>(
      `${this.basePath}/api/configuracao/vocabularios/${vocabulario}`,
      { context: withVendorMime(MIME[vocabulario], 1) },
    );
  }
}
