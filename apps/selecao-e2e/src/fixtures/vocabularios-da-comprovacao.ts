import type { CatalogoMockado } from '../support/responder';

export const VOCABULARIOS_DA_COMPROVACAO: readonly CatalogoMockado[] = [
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
