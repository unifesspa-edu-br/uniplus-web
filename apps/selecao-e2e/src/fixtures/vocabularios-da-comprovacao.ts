import type { CatalogoMockado } from '../support/responder';

export const VOCABULARIOS_DA_COMPROVACAO: readonly CatalogoMockado[] = [
  [
    'selecao/vocabularios/escolhas-prazo-emissao',
    [
      { codigo: 'semPrazo', rotulo: 'Sem prazo' },
      { codigo: 'comPrazo', rotulo: 'Com prazo' },
    ],
  ],
  [
    'selecao/vocabularios/escolhas-validade',
    [
      { codigo: 'naoExigeDocumentoValido', rotulo: 'Não exige documento válido' },
      { codigo: 'exigeDocumentoValido', rotulo: 'Exige documento válido' },
    ],
  ],
  [
    'selecao/vocabularios/unidades-prazo-emissao',
    [
      { codigo: 'dias', rotulo: 'Dias' },
      { codigo: 'meses', rotulo: 'Meses' },
      { codigo: 'anos', rotulo: 'Anos' },
    ],
  ],
  [
    'selecao/vocabularios/tipos-data-referencia',
    [
      { codigo: 'fimDasInscricoes', rotulo: 'Fim das inscrições' },
      { codigo: 'inicioDaFase', rotulo: 'Início da fase' },
      { codigo: 'fimDaFase', rotulo: 'Fim da fase' },
      { codigo: 'dataEspecifica', rotulo: 'Data específica' },
      { codigo: 'dataDaApresentacao', rotulo: 'Data da apresentação' },
    ],
  ],
  [
    'selecao/vocabularios/efeitos-analise-documento',
    [
      { codigo: 'recusarDocumento', rotulo: 'Recusar documento' },
      { codigo: 'aceitarComAviso', rotulo: 'Aceitar com aviso' },
    ],
  ],
  [
    'selecao/vocabularios/formas-comprovacao',
    [
      { codigo: 'DOCUMENTO', rotulo: 'Documento' },
      { codigo: 'TODOS_OS_ITENS', rotulo: 'Todos estes' },
      { codigo: 'QUANTIDADE_MINIMA_DE_ITENS', rotulo: 'Quantidade mínima' },
    ],
  ],
  [
    'selecao/vocabularios/formatos-permitidos',
    [
      { codigo: 'PDF', rotulo: 'PDF' },
      { codigo: 'PNG', rotulo: 'PNG' },
    ],
  ],
  [
    'selecao/vocabularios/criterios-distincao-apresentacoes',
    [{ codigo: 'COMPETENCIA_MENSAL', rotulo: 'Competência mensal' }],
  ],
  [
    'selecao/vocabularios/consequencias-indeferimento',
    [
      { codigo: 'ELIMINA', rotulo: 'Eliminação' },
      { codigo: 'RECLASSIFICA_AC', rotulo: 'Reclassificação para ampla concorrência' },
    ],
  ],
];
