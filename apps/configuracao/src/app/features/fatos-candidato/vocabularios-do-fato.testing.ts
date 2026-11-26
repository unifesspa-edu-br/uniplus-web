import { HttpTestingController } from '@angular/common/http/testing';
import {
  ComponenteDeExibicaoCodigo,
  EscopoFatoCodigo,
  FonteValoresFatoCodigo,
  FormatoTextoCodigo,
  HipoteseLegalTratamentoCodigo,
  OrigemFatoCodigo,
  QuantidadeDeValoresCodigo,
} from '@uniplus/shared-data/configuracao';
import { codigoComRotulo } from './fatos-candidato.fixtures';

const opcoes = <T extends string>(codigos: readonly T[]) =>
  codigos.map((codigo) => codigoComRotulo(codigo, `Rótulo ${codigo}`));

export const VOCABULARIOS_DO_FATO = {
  'quantidades-de-valores': opcoes(Object.values(QuantidadeDeValoresCodigo)),
  'origens-fato': [
    codigoComRotulo(OrigemFatoCodigo.CALCULADO, 'Calculado'),
    codigoComRotulo(OrigemFatoCodigo.DECLARADO, 'Declarado'),
    codigoComRotulo(OrigemFatoCodigo.INTEGRACAO, 'Integração'),
  ],
  'fontes-valores-fato': opcoes(Object.values(FonteValoresFatoCodigo)),
  'formatos-texto': opcoes(Object.values(FormatoTextoCodigo)),
  'escopos-fato': opcoes(Object.values(EscopoFatoCodigo)),
  'componentes-de-exibicao': opcoes(Object.values(ComponenteDeExibicaoCodigo)).map((item) =>
    item.codigo === ComponenteDeExibicaoCodigo.MOEDA
      ? codigoComRotulo(item.codigo, 'Valor em reais')
      : item,
  ),
  'hipoteses-legais-tratamento': opcoes(Object.values(HipoteseLegalTratamentoCodigo)),
};

export function atenderVocabulariosDoFato(http: HttpTestingController): void {
  for (const [nome, itens] of Object.entries(VOCABULARIOS_DO_FATO)) {
    const sufixo = `/api/configuracao/vocabularios/${nome}`;
    for (const pedido of http.match((requisicao) => requisicao.url.endsWith(sufixo))) {
      if (!pedido.cancelled) pedido.flush(itens);
    }
  }
}
