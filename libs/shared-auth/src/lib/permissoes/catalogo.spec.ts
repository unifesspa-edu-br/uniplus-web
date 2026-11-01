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

  it('declara a consulta de dado por classe e a revelação de identificador, sem a revelação de CPF antiga', () => {
    expect([
      PERMISSAO.selecao.dadosPublicosConsultar,
      PERMISSAO.selecao.dadosInternosConsultar,
      PERMISSAO.selecao.dadosPessoaisConsultar,
      PERMISSAO.selecao.dadosSensiveisConsultar,
      PERMISSAO.selecao.dadosIdentificadoresRevelar,
    ]).toEqual([
      'selecao:dados-publicos:consultar',
      'selecao:dados-internos:consultar',
      'selecao:dados-pessoais:consultar',
      'selecao:dados-sensiveis:consultar',
      'selecao:dados-identificadores:revelar',
    ]);
    expect(Object.values(PERMISSAO.selecao)).not.toContain('selecao:inscricoes:revelar-cpf');
  });
});
