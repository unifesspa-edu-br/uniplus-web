import { By } from '@angular/platform-browser';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { recurso } from './configuracao-da-fase.testing';
import { DocumentosDaFaseComponent } from './documentos/documentos-da-fase.component';
import { ExigenciasDaFaseStore } from './documentos/exigencias-da-fase.store';
import { PARAMETROS_SEM_INSTANCIA_SUPERIOR } from '../../shared/configuracao-do-recurso/parametros-do-recurso.testing';
import { fase, ID_BANCA_HETERO, ID_CPF, montarFase, type FaseMontada } from './fase.testing';

const RECURSO = recurso({
  ...PARAMETROS_SEM_INSTANCIA_SUPERIOR,
});

describe('campos de texto das seções da fase', () => {
  let passo: FaseMontada;

  beforeEach(async () => {
    passo = await montarFase();
    passo.comCronograma(
      fase({
        produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
        regraRecurso: RECURSO,
        bancasRequeridas: [
          {
            id: null,
            identificadorLocal: 'banca-teste',
            copiaDoTipo: null,
            tipoBancaId: ID_BANCA_HETERO,
            categoriasDocumentoIds: [],
            regraDeDeliberacao: null,
          },
        ],
      }),
    );
    passo.raiz.injector.get(ExigenciasDaFaseStore).alternarExigencia(ID_CPF, true);
    passo.raiz
      .query(By.directive(DocumentosDaFaseComponent))
      .componentInstance.alternarEdicao(ID_CPF, true);
    passo.detectar();
  });

  afterEach(() => passo.controller.verify());

  it.each([
    ['publicações', 'produto-ato-0'],
    ['regra de recurso', 'regra'],
    ['editor da exigência', `doc-normas-${ID_CPF}-base-0-ref`],
  ])('a seção de %s aplica a ValorLegivelDirective ao campo %s', (_secao, sufixo) => {
    const campo = passo.raiz.query(By.css(`#fase-AVALIACAO-${sufixo}`));

    expect(campo, sufixo).not.toBeNull();
    expect(campo.injector.get(ValorLegivelDirective, null)).not.toBeNull();
  });
});
