import { PERMISSAO } from './catalogo';

describe('PERMISSAO.selecao', () => {
  it('declara uma permissão de consulta de arquivo para cada classificação', () => {
    expect([
      PERMISSAO.selecao.documentosPublicosConsultar,
      PERMISSAO.selecao.documentosInternosConsultar,
      PERMISSAO.selecao.documentosPessoaisConsultar,
      PERMISSAO.selecao.documentosIdentificadoresConsultar,
      PERMISSAO.selecao.documentosSensiveisConsultar,
    ]).toEqual([
      'selecao:documentos-publicos:consultar',
      'selecao:documentos-internos:consultar',
      'selecao:documentos-pessoais:consultar',
      'selecao:documentos-identificadores:consultar',
      'selecao:documentos-sensiveis:consultar',
    ]);
  });
});
