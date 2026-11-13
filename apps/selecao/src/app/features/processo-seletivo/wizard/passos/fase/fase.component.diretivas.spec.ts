import { UnidadePrazo } from '@uniplus/shared-data/selecao';
import { By } from '@angular/platform-browser';
import { ValorLegivelDirective } from '@uniplus/shared-ui/components';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { RecursoDaFase } from '../../processo-seletivo.models';
import { DocumentosDaFaseComponent } from './documentos/documentos-da-fase.component';
import { ExigenciasDaFaseStore } from './documentos/exigencias-da-fase.store';
import { fase, ID_BANCA_HETERO, ID_CPF, montarFase, type FaseMontada } from './fase.testing';

const RECURSO: RecursoDaFase = {
  regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
  regraVersao: 'v1',
  prazoValor: '2',
  prazoUnidade: UnidadePrazo.diasUteis,
  atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
  suspensividadePrimeiraInstanciaValor: '',
  suspensividadePrimeiraInstanciaUnidade: '',
  admiteInstanciaSuperior: false,
  suspensividadeSegundaInstanciaValor: '',
  suspensividadeSegundaInstanciaUnidade: '',
};

describe('campos de texto das seções da fase', () => {
  let passo: FaseMontada;

  beforeEach(async () => {
    passo = await montarFase();
    passo.comCronograma(
      fase({
        produtos: [{ atoCodigo: 'RESULTADO_PRELIMINAR', papel: 'PRELIMINAR' }],
        regraRecurso: RECURSO,
        bancasRequeridas: [
          { tipoBancaId: ID_BANCA_HETERO, categoriasDocumentoIds: [], regraDeDeliberacao: null },
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
    ['ciclo recursal', 'concluinte'],
    ['regra de recurso', 'regra'],
    ['bancas', 'banca-0'],
    ['editor da exigência', `doc-base-legal-${ID_CPF}-0`],
  ])('a seção de %s aplica a ValorLegivelDirective ao campo %s', (_secao, sufixo) => {
    const campo = passo.raiz.query(By.css(`#fase-AVALIACAO-${sufixo}`));

    expect(campo, sufixo).not.toBeNull();
    expect(campo.injector.get(ValorLegivelDirective, null)).not.toBeNull();
  });
});
