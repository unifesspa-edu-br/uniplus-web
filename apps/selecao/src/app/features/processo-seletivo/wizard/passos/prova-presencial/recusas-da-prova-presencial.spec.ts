import { describe, expect, it } from 'vitest';
import type { RecusaOrdenada } from '../../shared/recusas/ordem-das-recusas';
import { recusasDaProvaPresencial } from './recusas-da-prova-presencial';

const municipios = [
  { codigoIbge: '1', uf: 'PA', nome: null },
  { codigoIbge: '2', uf: 'PA', nome: null },
];
function recusa(campo: string, codigo = 'ProvaPresencial.SemMunicipio', ordem = 0): RecusaOrdenada {
  return {
    campo,
    codigo,
    ordem,
    resposta: 1,
    origem: 'gravacao',
    aConferir: false,
    mensagem: 'Recusa',
    pagina: null,
  };
}

describe('recusas da prova presencial', () => {
  it('devolve grupos vazios para uma lista vazia', () => {
    expect(recusasDaProvaPresencial([], [])).toEqual({
      escolha: [],
      lista: [],
      porMunicipio: new Map(),
    });
  });
  it('usa o campo da API para direcionar a escolha independentemente do código', () => {
    const item = recusa('provaPresencial', 'ProvaPresencial.SemMunicipio');
    expect(recusasDaProvaPresencial([item], municipios).escolha).toEqual([item]);
  });
  it('direciona a lista e campos desconhecidos da prova à lista', () => {
    const itens = [recusa('provaPresencial.municipios'), recusa('provaPresencial.outro')];
    expect(recusasDaProvaPresencial(itens, municipios).lista).toEqual(itens);
  });
  it('resolve índices nas formas de colchetes, pontos e ponteiro JSON pela lista enviada', () => {
    const itens = [
      recusa('provaPresencial.municipios[0]'),
      recusa('provaPresencial.municipios.1.codigoIbge'),
      recusa('/provaPresencial/municipios/0/codigoIbge'),
      recusa('provaPresencial.municipios[0].uf'),
    ];
    const resultado = recusasDaProvaPresencial(itens, municipios);
    expect(resultado.porMunicipio.get('1')).toEqual([itens[0], itens[2], itens[3]]);
    expect(resultado.porMunicipio.get('2')).toEqual([itens[1]]);
  });
  it('envia posição fora da lista à lista', () => {
    const item = recusa('provaPresencial.municipios[2].codigoIbge');
    expect(recusasDaProvaPresencial([item], municipios).lista).toEqual([item]);
    expect(recusasDaProvaPresencial([item], []).lista).toEqual([item]);
  });
  it('usa código somente quando não há ponteiro', () => {
    const escolha = recusa('', 'ProvaPresencial.PorDeclarar');
    const municipio = recusa('', 'ProvaPresencial.MunicipioNaoConferidoNoGeo');
    const campo = recusa('provaPresencial.municipios', 'ProvaPresencial.PorDeclarar');
    const resultado = recusasDaProvaPresencial([escolha, municipio, campo], municipios);
    expect(resultado.escolha).toEqual([escolha]);
    expect(resultado.lista).toEqual([municipio, campo]);
  });
  it('ignora recusas de outros campos e códigos sem ponteiro', () => {
    expect(
      recusasDaProvaPresencial([recusa('outro'), recusa('', 'Outro.Erro')], municipios).lista,
    ).toEqual([]);
  });
  it('ordena e deduplica recusas segundo a ordem compartilhada', () => {
    const antiga = { ...recusa('provaPresencial.municipios'), resposta: 1 };
    const recente = { ...antiga, resposta: 2 };
    const primeira = recusa('provaPresencial.outro', 'Outro', 0);
    expect(recusasDaProvaPresencial([antiga, primeira, recente], municipios).lista).toEqual([
      recente,
      primeira,
    ]);
  });
});
