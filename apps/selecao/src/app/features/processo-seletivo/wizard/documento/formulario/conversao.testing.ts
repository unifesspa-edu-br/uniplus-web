import {
  FinalidadeDoFormulario,
  TipoDaEtapaDoFormulario,
  type DocumentoDaConfiguracaoFormulario,
} from '@uniplus/shared-data/selecao';
import type {
  ConteudoDoFormulario,
  CamposEditadosDoFormulario,
} from '@uniplus/shared-ui/components';
import { conteudoDoDocumento, documentoDoConteudo } from './conversao-do-formulario';
import type {
  CatalogosDaConversaoDoFormulario,
  ResultadoDaConversaoDoFormulario,
} from './resultado-da-conversao';

export const CATALOGOS: CatalogosDaConversaoDoFormulario = {
  fatos: [
    { codigo: 'RENDA', tipoRenderizacao: 'NUMERO' },
    { codigo: 'PARENTESCO', tipoRenderizacao: 'SELECAO_UNICA' },
  ],
  termos: [
    { termoId: 'termo', termoCodigo: 'CONSENTIMENTO', versaoId: 'primeira', versaoNumero: 1 },
    { termoId: 'termo', termoCodigo: 'CONSENTIMENTO', versaoId: 'segunda', versaoNumero: 2 },
    { termoId: 'outro', termoCodigo: 'OUTRO', versaoId: 'terceira', versaoNumero: 1 },
  ],
};

export function formulario(): DocumentoDaConfiguracaoFormulario {
  return {
    finalidade: FinalidadeDoFormulario.INSCRICAO,
    faseChave: 'inscricao',
    modeloOrigemCodigo: 'MODELO',
    etapas: [{ codigo: 'dados', tipo: TipoDaEtapaDoFormulario.SECAO }],
    itens: [
      { fatoCodigo: 'RENDA', precondicao: null, opcoes: [{ codigo: 'opcao', rotulo: 'Opção' }] },
    ],
    grupos: [{ codigo: 'familia', subitens: [{ fatoCodigo: 'PARENTESCO' }] }],
    termos: [{ codigo: 'aceite', termoCodigo: 'CONSENTIMENTO', versaoNumero: 1 }],
  };
}

export function aceita(resultado: ResultadoDaConversaoDoFormulario) {
  if (!resultado.ok) throw new Error('A conversão de teste precisa ser aceita.');
  return resultado;
}

export function editar(
  original: DocumentoDaConfiguracaoFormulario,
  alterar: (conteudo: ConteudoDoFormulario) => ConteudoDoFormulario,
  camposEditados: CamposEditadosDoFormulario = [],
  catalogos = CATALOGOS,
) {
  const atual = aceita(conteudoDoDocumento(original, CATALOGOS));
  return documentoDoConteudo(
    atual,
    { conteudo: alterar(atual.conteudo), camposEditados },
    catalogos,
  );
}
