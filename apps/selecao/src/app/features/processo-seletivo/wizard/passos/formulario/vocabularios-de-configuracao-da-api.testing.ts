import { HttpHeaders } from '@angular/common/http';
import type { Provider } from '@angular/core';
import { of } from 'rxjs';
import { apiOk } from '@uniplus/shared-core/http';
import { VocabulariosDeConfiguracaoApi } from '@uniplus/shared-data/configuracao';
import { TIPOS_DE_CAMPO_SIMULADOS } from '@uniplus/shared-testing';

/**
 * A API de vocabulários da Configuração que responde com os tipos de campo simulados. Serve a quem
 * monta a página do processo: o formulário lê os tipos de campo desta API ao abrir.
 */
export function provideApiDosVocabulariosDeConfiguracao(): Provider {
  return {
    provide: VocabulariosDeConfiguracaoApi,
    useValue: { listar: () => of(apiOk(TIPOS_DE_CAMPO_SIMULADOS, 200, new HttpHeaders())) },
  };
}
