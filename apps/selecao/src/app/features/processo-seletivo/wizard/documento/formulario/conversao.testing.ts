import {
  TipoDaPaginaDoFormulario,
  type DocumentoDaConfiguracaoFormulario,
} from '@uniplus/shared-data/selecao';
import type {
  ConteudoDoFormulario,
  CamposEditadosDoFormulario,
} from '@uniplus/shared-inscricao/formulario';
import { conteudoDoDocumento, documentoDoConteudo } from './conversao-do-formulario';
import type {
  CatalogosDaConversaoDoFormulario,
  ResultadoDaConversaoDoFormulario,
} from './resultado-da-conversao';

export const CATALOGOS: CatalogosDaConversaoDoFormulario = {
  fatos: [
    { codigo: 'RENDA', tipoDeCampo: 'NUMERO' },
    { codigo: 'PARENTESCO', tipoDeCampo: 'ESCOLHA_UNICA' },
  ],
  termos: [
    { termoId: 'termo', termoCodigo: 'CONSENTIMENTO', versaoId: 'primeira', versaoNumero: 1 },
    { termoId: 'termo', termoCodigo: 'CONSENTIMENTO', versaoId: 'segunda', versaoNumero: 2 },
    { termoId: 'outro', termoCodigo: 'OUTRO', versaoId: 'terceira', versaoNumero: 1 },
  ],
};

export function formulario(): DocumentoDaConfiguracaoFormulario {
  return {
    codigo: 'INSCRICAO',
    faseChave: 'inscricao',
    modeloOrigemCodigo: 'MODELO',
    paginas: [{ codigo: 'dados', tipo: TipoDaPaginaDoFormulario.SECAO }],
    itens: [
      { codigoDoDado: 'RENDA', exibicao: null, opcoes: [{ codigo: 'opcao', rotulo: 'Opção' }] },
    ],
    grupos: [{ codigo: 'familia', subitens: [{ codigoDoDado: 'PARENTESCO' }] }],
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
