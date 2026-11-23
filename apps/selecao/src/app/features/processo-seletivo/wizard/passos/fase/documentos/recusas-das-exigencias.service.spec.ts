import { RecusasDasExigencias } from './recusas-das-exigencias.service';

const primeira = {
  identificadorDaRegra: '1',
  codigo: 'INVALIDO',
  campo: 'documento.requisitos.formatosPermitidos',
  mensagem: 'Primeira',
};
const segunda = { ...primeira, identificadorDaRegra: '2', mensagem: 'Segunda' };

describe('RecusasDasExigencias', () => {
  it('limpa somente o campo da regra editada', () => {
    const recusas = new RecusasDasExigencias();
    recusas.registrar([primeira, segunda]);
    expect(recusas.doCampo('2', segunda.campo)).toEqual([segunda]);
    recusas.limparCampo('2', segunda.campo);
    expect(recusas.doCampo('2', segunda.campo)).toEqual([]);
    expect(recusas.doCampo('1', primeira.campo)).toEqual([primeira]);
  });

  it('associa e limpa a recusa de um formato específico', () => {
    const recusas = new RecusasDasExigencias();
    const recusa = { ...segunda, campo: segunda.campo + '[0].formato' };
    recusas.registrar([primeira, recusa]);
    expect(recusas.doCampo('2', segunda.campo)).toEqual([recusa]);
    recusas.limparCampo('2', segunda.campo);
    expect(recusas.doCampo('2', segunda.campo)).toEqual([]);
    expect(recusas.doCampo('1', primeira.campo)).toEqual([primeira]);
  });

  it('limpa todas as recusas para nova gravação', () => {
    const recusas = new RecusasDasExigencias();
    recusas.registrar([primeira, segunda]);
    recusas.limpar();
    expect(recusas.doCampo('1', primeira.campo)).toEqual([]);
    expect(recusas.doCampo('2', segunda.campo)).toEqual([]);
  });
});
