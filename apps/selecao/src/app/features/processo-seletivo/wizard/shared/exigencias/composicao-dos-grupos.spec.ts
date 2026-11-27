import { exigencia, rascunho } from './exigencias.testing';
import {
  criarGrupo,
  editarGrupo,
  incluirNoGrupo,
  retirarDoGrupo,
  trocarCriterioDeDistincao,
  trocarFormaDoGrupo,
  trocarQuantidadeMinima,
} from './composicao-dos-grupos';

function documentos() {
  return rascunho(
    exigencia(),
    exigencia({ tipoDocumentoId: 'cin' }),
    exigencia({ tipoDocumentoId: 'cnh' }),
  );
}

function grupoDeTres() {
  const antes = documentos();
  const identificadores = antes.regrasDeComprovacao.map((regra) => regra.identificadorNoRascunho);
  return criarGrupo(antes, identificadores, 'grupo');
}

describe('composição dos grupos', () => {
  it('combina documentos sem alterar o rascunho recebido', () => {
    const antes = documentos();
    const identificadores = antes.regrasDeComprovacao
      .slice(0, 2)
      .map((regra) => regra.identificadorNoRascunho);
    const depois = criarGrupo(antes, identificadores, 'grupo');
    expect(antes.regrasDeComprovacao).toHaveLength(3);
    expect(depois.regrasDeComprovacao[1]).toMatchObject({
      forma: 'QUANTIDADE_MINIMA_DE_ITENS',
      quantidadeMinima: 1,
    });
    expect(depois.regrasDeComprovacao[1].itens).toHaveLength(2);
  });

  it('recusa documentos de momentos diferentes', () => {
    const antes = rascunho(exigencia(), exigencia({ etapaId: 'etapa' }));
    const identificadores = antes.regrasDeComprovacao.map((regra) => regra.identificadorNoRascunho);
    expect(criarGrupo(antes, identificadores, 'grupo')).toBe(antes);
  });

  it('valida a quantidade mínima', () => {
    const grupo = grupoDeTres();
    expect(trocarQuantidadeMinima(grupo, 'grupo', 0).regrasDeComprovacao[0].quantidadeMinima).toBe(
      0,
    );
    expect(trocarQuantidadeMinima(grupo, 'grupo', 4).regrasDeComprovacao[0].quantidadeMinima).toBe(
      4,
    );
    expect(trocarQuantidadeMinima(grupo, 'grupo', 3).regrasDeComprovacao[0].quantidadeMinima).toBe(
      3,
    );
  });

  it('altera e remove o critério de distinção sem modificar o grupo original', () => {
    const original = grupoDeTres();
    const alterado = trocarCriterioDeDistincao(original, 'grupo', 'COMPETENCIA_MENSAL');
    expect(original.regrasDeComprovacao[0].criterioDeDistincao).toBeNull();
    expect(alterado.regrasDeComprovacao[0].criterioDeDistincao).toBe('COMPETENCIA_MENSAL');
    expect(
      trocarCriterioDeDistincao(alterado, 'grupo', null).regrasDeComprovacao[0].criterioDeDistincao,
    ).toBeNull();
  });

  it('alterna a forma do grupo', () => {
    const todos = trocarFormaDoGrupo(grupoDeTres(), 'grupo', 'TODOS_OS_ITENS');
    expect(todos.regrasDeComprovacao[0].quantidadeMinima).toBeNull();
    expect(
      trocarFormaDoGrupo(todos, 'grupo', 'QUANTIDADE_MINIMA_DE_ITENS').regrasDeComprovacao[0]
        .quantidadeMinima,
    ).toBe(1);
  });

  it('inclui e retira documentos preservando a quantidade possível', () => {
    const antes = documentos();
    const identificadores = antes.regrasDeComprovacao.map((regra) => regra.identificadorNoRascunho);
    const grupo = criarGrupo(antes, identificadores.slice(0, 2), 'grupo');
    const incluído = incluirNoGrupo(grupo, 'grupo', identificadores[2]);
    const comQuantidade = trocarQuantidadeMinima(incluído, 'grupo', 3);
    const retirado = retirarDoGrupo(comQuantidade, 'grupo', identificadores[0]);
    expect(retirado.regrasDeComprovacao[0].quantidadeMinima).toBe(2);
    expect(retirado.regrasDeComprovacao[1].identificadorNoRascunho).toBe(identificadores[0]);
    expect(
      retirarDoGrupo(retirado, 'grupo', identificadores[1]).regrasDeComprovacao[0].itens,
    ).toHaveLength(1);
  });

  it('altera os dados próprios do grupo', () => {
    const antes = documentos();
    const identificadores = antes.regrasDeComprovacao.map((regra) => regra.identificadorNoRascunho);
    const grupo = criarGrupo(antes, identificadores, 'grupo');
    expect(
      editarGrupo(grupo, 'grupo', { consequencia: 'INDEFERIMENTO', basesLegais: [] })
        .regrasDeComprovacao[0],
    ).toMatchObject({ consequencia: 'INDEFERIMENTO', basesLegais: [] });
  });

  it('a alteração parcial mantém os outros campos do grupo', () => {
    const base = editarGrupo(grupoDeTres(), 'grupo', {
      consequencia: 'INDEFERIMENTO',
      abrePrazoParaReenvio: true,
    });
    const normas = editarGrupo(base, 'grupo', { basesLegais: [] });
    expect(normas.regrasDeComprovacao[0]).toMatchObject({
      consequencia: 'INDEFERIMENTO',
      abrePrazoParaReenvio: true,
      basesLegais: [],
    });
    const consequencia = editarGrupo(normas, 'grupo', { consequencia: null });
    expect(consequencia.regrasDeComprovacao[0].abrePrazoParaReenvio).toBe(true);
  });

  it('inclui um grupo em outro e impede uma inclusão circular', () => {
    const quarto = rascunho(exigencia({ tipoDocumentoId: 'passaporte' }));
    const antes = documentos();
    const combinado = {
      ...antes,
      regrasDeComprovacao: [...antes.regrasDeComprovacao, ...quarto.regrasDeComprovacao],
    };
    const regras = combinado.regrasDeComprovacao;
    const identificadores = regras.map(({ identificadorNoRascunho }) => identificadorNoRascunho);
    const primeiro = criarGrupo(combinado, identificadores.slice(0, 2), 'primeiro');
    const segundo = criarGrupo(primeiro, identificadores.slice(2), 'segundo');
    const dentro = incluirNoGrupo(segundo, 'primeiro', 'segundo');
    expect(dentro.regrasDeComprovacao[0].itens?.[2].identificadorNoRascunho).toBe('segundo');
    expect(incluirNoGrupo(dentro, 'segundo', 'primeiro')).toBe(dentro);
  });
});
