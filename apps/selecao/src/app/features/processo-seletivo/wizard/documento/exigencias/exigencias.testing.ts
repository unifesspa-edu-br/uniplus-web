import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';

import type {
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  RegraDeComprovacao,
} from '../../modelos/exigencias.models';
import {
  comExigenciaSemGrupo,
  exigenciaNova,
} from '../../shared/exigencias/exigencias-documentais';
import type { ReservasDeChaves } from '../chaves-tomadas';
import { documentoSemNada } from '../exemplos.testing';
import { edicaoDasExigencias } from '../edicoes/documentos-exigidos.edicao';
import { exigenciasDoDocumento } from './leitura-das-exigencias-do-documento';

const FASES = [
  { chave: 'fase_inscricao', tipoFaseCodigo: 'INSCRICAO', noMesmoMomentoDaAnterior: false },
  { chave: 'fase_habilitacao', tipoFaseCodigo: 'HABILITACAO', noMesmoMomentoDaAnterior: false },
];

const EXIGENCIA_DO_DOCUMENTO_DE_IDENTIDADE = {
  id: '0196b3c2-8a10-7c3e-b5d2-6f1e4a9c2d71',
  chave: 'exigencia_rg',
  tipoDocumentoCodigo: 'RG',
  tipoDocumentoNome: 'Documento de identidade',
  tipoDocumentoCategoria: 'Identificação',
  classificacaoProtecao: 'PESSOAL',
  finalidadeTratamento: 'Comprovar a identidade',
  hipoteseLegal: 'Cumprimento de obrigação legal',
  dadosComprovados: ['NOME_CIVIL'],
  faseChave: 'fase_inscricao',
  formularioCodigo: 'INSCRICAO',
  aplicabilidade: 'GERAL',
  aplicabilidadeRotulo: 'Geral',
  obrigatorio: true,
  abrePrazoParaReenvio: false,
  consequenciaDoDescumprimento: 'ELIMINA_DO_PROCESSO',
  consequenciaDoDescumprimentoRotulo: 'Elimina do processo',
  basesLegais: [
    {
      referencia: 'Edital, item 4',
      abrangencia: 'INTERNA_EDITAL',
      abrangenciaRotulo: 'Edital',
      situacao: 'RESOLVIDO',
      situacaoRotulo: 'Resolvido',
      observacao: 'Vale para todos',
    },
  ],
  formatosPermitidos: {
    lista: [{ formato: 'PDF', formatoRotulo: 'PDF', tamanhoMaximoBytesMax: 2097152 }],
  },
  tamanhoMaximoBytes: 5242880,
  modeloId: '0196b3c2-8a10-7c3e-b5d2-6f1e4a9c2d72',
  modelo: { nomeArquivo: 'modelo.docx', formato: 'DOCX', hashSha256: 'ab12' },
  prazoDeEmissao: {
    escolha: 'COM_PRAZO',
    escolhaRotulo: 'Com prazo',
    valor: 90,
    unidade: 'DIAS',
    unidadeRotulo: 'Dias',
    referencia: { tipo: 'FIM_DAS_INSCRICOES', tipoRotulo: 'Fim das inscrições' },
    efeitoForaDoPrazo: 'RECUSAR_DOCUMENTO',
  },
  validade: {
    escolha: 'EXIGE_DOCUMENTO_VALIDO',
    referencia: { tipo: 'INICIO_DA_FASE', faseChave: 'fase_habilitacao' },
    efeitoDoVencimento: 'ACEITAR_COM_AVISO',
  },
};

const EXIGENCIA_DE_RENDA = {
  chave: 'exigencia_comprovante_renda',
  tipoDocumentoCodigo: 'COMPROVANTE_RENDA',
  tipoDocumentoNome: 'Comprovante de renda',
  faseChave: 'fase_habilitacao',
  etapaChave: 'etapa_analise',
  aplicabilidade: 'CONDICIONAL',
  obrigatorio: true,
  abrePrazoParaReenvio: true,
  condicoes: [
    [
      {
        codigoDoDado: 'MODALIDADE',
        operador: 'ALGUM_DE',
        operadorRotulo: 'Algum de',
        valor: ['LB_PPI'],
      },
      { codigoDoDado: 'RENDA_PER_CAPITA', operador: 'MENOR_IGUAL', valor: 1.5 },
    ],
    [
      { codigoDoDado: 'MODALIDADE', operador: 'ALGUM_DE', valor: ['LB_PPI'] },
      { codigoDoDado: 'POSSUI_DEFICIENCIA', operador: 'IGUAL', valor: true },
      { codigoDoDado: 'ESTADO', operador: 'IGUAL', valor: 'PA' },
    ],
  ],
};

const EXIGENCIA_DE_LAUDO = {
  chave: 'exigencia_laudo_medico',
  tipoDocumentoCodigo: 'LAUDO_MEDICO',
  faseChave: 'fase_habilitacao',
  obrigatorio: false,
  abrePrazoParaReenvio: false,
};

const EXIGENCIA_SEM_REGRA = {
  chave: 'exigencia_certidao_nascimento',
  tipoDocumentoCodigo: 'CERTIDAO_NASCIMENTO',
  faseChave: 'fase_inscricao',
  obrigatorio: true,
  abrePrazoParaReenvio: false,
};

const REGRAS = [
  { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_rg' },
  {
    forma: 'QUANTIDADE_MINIMA_DE_ITENS',
    quantidadeMinima: 1,
    abrePrazoParaReenvio: true,
    consequenciaDoDescumprimento: 'RETIRA_A_MODALIDADE',
    consequenciaDoDescumprimentoRotulo: 'Retira a modalidade',
    basesLegais: [
      { referencia: 'Portaria 12', abrangencia: 'INTERNA_NORMA', situacao: 'PENDENTE' },
    ],
    itens: [
      { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_comprovante_renda' },
      { forma: 'DOCUMENTO', exigenciaChave: 'exigencia_laudo_medico' },
    ],
  },
];

export function documentoComExigencias(): DocumentoDaConfiguracao {
  return comDocumentosExigidos({
    exigencias: [
      EXIGENCIA_DO_DOCUMENTO_DE_IDENTIDADE,
      EXIGENCIA_DE_RENDA,
      EXIGENCIA_DE_LAUDO,
      EXIGENCIA_SEM_REGRA,
    ],
    regrasDeComprovacao: REGRAS,
  });
}

/** O documento com as exigências e as regras trocadas, sem mexer no cronograma. */
export function comDocumentosExigidos(
  documentosExigidos: Record<string, unknown>,
  fases: readonly unknown[] = FASES,
): DocumentoDaConfiguracao {
  return structuredClone({
    ...documentoSemNada(),
    cronograma: { fases },
    documentosExigidos,
  }) as unknown as DocumentoDaConfiguracao;
}

export function reservasDe(documento: DocumentoDaConfiguracao): ReservasDeChaves {
  return { original: documento, criadas: [] };
}

export function lidas(documento: DocumentoDaConfiguracao): ExigenciasDoRascunho {
  const leitura = exigenciasDoDocumento(documento);
  if (!leitura.ok) throw new Error('A leitura das exigências não deveria ter impedimentos.');
  return leitura.exigencias;
}

/** O que a tela faz com as exigências lidas: edita e devolve ao documento. */
export function idaEVolta(
  documento: DocumentoDaConfiguracao,
  editar: (exigencias: ExigenciasDoRascunho) => ExigenciasDoRascunho = (exigencias) => exigencias,
): DocumentoDaConfiguracao {
  const exigencias = editar(lidas(documento));
  return edicaoDasExigencias(exigencias, reservasDe(documento))(documento);
}

export function regraDaPosicao(
  exigencias: ExigenciasDoRascunho,
  posicao: number,
): RegraDeComprovacao {
  return exigencias.regrasDeComprovacao[posicao];
}

/** As regras de documento da tela, em qualquer profundidade, com a exigência de cada uma. */
export function documentoDaRegra(regra: RegraDeComprovacao): ExigenciaDeDocumento {
  if (regra.documento === null) throw new Error('A regra não tem documento.');
  return regra.documento;
}

export function comRegra(
  exigencias: ExigenciasDoRascunho,
  posicao: number,
  alterar: (regra: RegraDeComprovacao) => RegraDeComprovacao,
): ExigenciasDoRascunho {
  const regras = exigencias.regrasDeComprovacao.map((regra, indice) =>
    indice === posicao ? alterar(regra) : regra,
  );
  return { ...exigencias, regrasDeComprovacao: regras };
}

export function comDocumento(
  regra: RegraDeComprovacao,
  alteracao: Partial<ExigenciaDeDocumento>,
): RegraDeComprovacao {
  return { ...regra, documento: { ...documentoDaRegra(regra), ...alteracao } };
}

export function secaoDe(documento: DocumentoDaConfiguracao) {
  return documento.documentosExigidos ?? {};
}

export function adicionando(
  exigencias: ExigenciasDoRascunho,
  codigo: string,
): ExigenciasDoRascunho {
  return comExigenciaSemGrupo(exigencias, exigenciaNova(codigo, 'INSCRICAO'));
}
