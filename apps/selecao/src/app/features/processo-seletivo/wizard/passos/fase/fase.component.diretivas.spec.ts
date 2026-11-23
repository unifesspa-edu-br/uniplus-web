import { By } from '@angular/platform-browser';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { identificadorDaRegra } from './fase-passo.testing';
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
    passo.elementoDaTela.injector.get(ExigenciasDaFaseStore).alternarExigencia(ID_CPF, true);
    passo.elementoDaTela
      .query(By.directive(DocumentosDaFaseComponent))
      .componentInstance.alternarEdicao(
        identificadorDaRegra(passo.elementoDaTela.injector.get(ExigenciasDaFaseStore), ID_CPF),
        true,
      );
    passo.detectar();
  });

  afterEach(() => {
    passo.controller
      .match((pedido) => pedido.url.includes('/vocabularios/'))
      .forEach((requisicao) => requisicao.flush([]));
    passo.controller.verify();
  });

  it.each([
    ['publicações', 'produto-ato-0'],
    ['regra de recurso', 'regra'],
    ['editor da exigência', 'doc-normas'],
  ])('a seção de %s aplica a ValorLegivelDirective ao campo %s', (_secao, sufixo) => {
    const identificador = identificadorDaRegra(
      passo.elementoDaTela.injector.get(ExigenciasDaFaseStore),
      ID_CPF,
    );
    const nome = sufixo === 'doc-normas' ? `${sufixo}-${identificador}-base-0-ref` : sufixo;
    const campo = passo.elementoDaTela.query(By.css(`#fase-AVALIACAO-${nome}`));

    expect(campo, sufixo).not.toBeNull();
    expect(campo.injector.get(ValorLegivelDirective, null)).not.toBeNull();
  });
});
