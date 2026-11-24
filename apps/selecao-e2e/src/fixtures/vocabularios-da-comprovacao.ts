import type { CatalogoMockado } from '../support/responder';

export const VOCABULARIOS_DA_COMPROVACAO: readonly CatalogoMockado[] = [
  [
    'selecao/vocabularios/escolhas-prazo-emissao',
    [
      { codigo: 'SEM_PRAZO', rotulo: 'Sem prazo' },
      { codigo: 'COM_PRAZO', rotulo: 'Com prazo' },
    ],
  ],
  [
    'selecao/vocabularios/escolhas-validade',
    [
      { codigo: 'NAO_EXIGE_DOCUMENTO_VALIDO', rotulo: 'Não exige documento válido' },
      { codigo: 'EXIGE_DOCUMENTO_VALIDO', rotulo: 'Exige documento válido' },
    ],
  ],
  [
    'selecao/vocabularios/unidades-prazo-emissao',
    [
      { codigo: 'DIAS', rotulo: 'Dias' },
      { codigo: 'MESES', rotulo: 'Meses' },
      { codigo: 'ANOS', rotulo: 'Anos' },
    ],
  ],
  [
    'selecao/vocabularios/tipos-data-referencia',
    [
      { codigo: 'FIM_DAS_INSCRICOES', rotulo: 'Fim das inscrições' },
      { codigo: 'INICIO_DA_FASE', rotulo: 'Início da fase' },
      { codigo: 'FIM_DA_FASE', rotulo: 'Fim da fase' },
      { codigo: 'DATA_ESPECIFICA', rotulo: 'Data específica' },
      { codigo: 'DATA_DA_APRESENTACAO', rotulo: 'Data da apresentação' },
    ],
  ],
  [
    'selecao/vocabularios/efeitos-analise-documento',
    [
      { codigo: 'RECUSAR_DOCUMENTO', rotulo: 'Recusar documento' },
      { codigo: 'ACEITAR_COM_AVISO', rotulo: 'Aceitar com aviso' },
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
