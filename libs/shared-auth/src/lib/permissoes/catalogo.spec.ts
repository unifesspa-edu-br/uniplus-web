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

  it('declara a consulta de dado por classe e, no identificador, a consulta mascarada e a revelação, sem a revelação de CPF antiga', () => {
    expect([
      PERMISSAO.selecao.dadosPublicosConsultar,
      PERMISSAO.selecao.dadosInternosConsultar,
      PERMISSAO.selecao.dadosPessoaisConsultar,
      PERMISSAO.selecao.dadosSensiveisConsultar,
      PERMISSAO.selecao.dadosIdentificadoresConsultar,
      PERMISSAO.selecao.dadosIdentificadoresRevelar,
    ]).toEqual([
      'selecao:dados-publicos:consultar',
      'selecao:dados-internos:consultar',
      'selecao:dados-pessoais:consultar',
      'selecao:dados-sensiveis:consultar',
      'selecao:dados-identificadores:consultar',
      'selecao:dados-identificadores:revelar',
    ]);
    expect(Object.values(PERMISSAO.selecao)).not.toContain('selecao:inscricoes:revelar-cpf');
  });

  it('declara a emissão do comprovante da inscrição pela unidade', () => {
    expect(PERMISSAO.selecao.inscricoesEmitirComprovante).toBe(
      'selecao:inscricoes:emitir-comprovante',
    );
  });
});

describe('PERMISSAO.autorizacao', () => {
  it('declara as permissões que aprovam a versão de um perfil em cada etapa', () => {
    expect([
      PERMISSAO.autorizacao.perfisAprovarFuncional,
      PERMISSAO.autorizacao.perfisAprovarProtecaoDeDados,
    ]).toEqual([
      'autorizacao:perfis:aprovar-funcional',
      'autorizacao:perfis:aprovar-protecao-de-dados',
    ]);
  });

  it('declara quem conduz, quem revê e quem só consulta a revisão periódica de acessos', () => {
    expect([
      PERMISSAO.autorizacao.revisoesConduzir,
      PERMISSAO.autorizacao.revisoesReverProtecaoDeDados,
      PERMISSAO.autorizacao.revisoesConsultar,
    ]).toEqual([
      'autorizacao:revisoes:conduzir',
      'autorizacao:revisoes:rever-protecao-de-dados',
      'autorizacao:revisoes:consultar',
    ]);
  });

  it('declara quem administra e quem só consulta as concessões', () => {
    expect([
      PERMISSAO.autorizacao.concessoesAdministrar,
      PERMISSAO.autorizacao.concessoesConsultar,
    ]).toEqual(['autorizacao:concessoes:administrar', 'autorizacao:concessoes:consultar']);
  });

  it('declara a publicação do termo de responsabilidade', () => {
    expect(PERMISSAO.autorizacao.termosPublicar).toBe('autorizacao:termos:publicar');
  });

  it('declara a consulta dos pedidos e das versões de perfil, sem decisão', () => {
    expect([
      PERMISSAO.autorizacao.pedidosConsultar,
      PERMISSAO.autorizacao.perfisConsultarVersoes,
    ]).toEqual(['autorizacao:pedidos:consultar', 'autorizacao:perfis:consultar-versoes']);
  });
});
