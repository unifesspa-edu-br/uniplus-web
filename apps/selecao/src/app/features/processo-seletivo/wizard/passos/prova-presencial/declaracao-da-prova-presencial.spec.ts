import { describe, expect, it } from 'vitest';
import {
  avisoDeRemocaoDosMunicipios,
  escolherProvaPresencial,
  comMunicipioAdicionado,
  semMunicipio,
  pedidoDaDeclaracao,
  municipiosQueSeraoRemovidos,
  rotuloDoMunicipio,
  type DeclaracaoDaProvaPresencial,
} from './declaracao-da-prova-presencial';

const municipio = { codigoIbge: '1501402', uf: 'PA', nome: 'Cidade fictícia' };
const declaracao: DeclaracaoDaProvaPresencial = {
  temProvaPresencial: true,
  municipios: [municipio],
};

describe('declaração da prova presencial', () => {
  it('preserva municípios ao escolher sem prova e voltar a escolher com prova', () => {
    expect(escolherProvaPresencial(escolherProvaPresencial(declaracao, false), true)).toEqual(
      declaracao,
    );
    expect(declaracao.temProvaPresencial).toBe(true);
  });
  it('adiciona município a uma lista vazia', () => {
    expect(comMunicipioAdicionado({ ...declaracao, municipios: [] }, municipio).municipios).toEqual(
      [municipio],
    );
  });
  it('não duplica município com o mesmo código IBGE', () => {
    expect(comMunicipioAdicionado(declaracao, { ...municipio, nome: null }).municipios).toEqual([
      municipio,
    ]);
  });
  it('remove somente o município com o código solicitado', () => {
    expect(semMunicipio(declaracao, municipio.codigoIbge).municipios).toEqual([]);
    expect(semMunicipio(declaracao, 'outro').municipios).toEqual([municipio]);
  });
  it('não gera pedido para escolha por declarar', () => {
    expect(pedidoDaDeclaracao({ ...declaracao, temProvaPresencial: null })).toBeNull();
  });
  it('envia somente código e UF dos municípios quando há prova', () => {
    expect(pedidoDaDeclaracao(declaracao)).toEqual({
      temProvaPresencial: true,
      municipios: [{ codigoIbge: municipio.codigoIbge, uf: municipio.uf }],
    });
  });
  it('envia lista vazia quando não há prova', () => {
    expect(pedidoDaDeclaracao(escolherProvaPresencial(declaracao, false))).toEqual({
      temProvaPresencial: false,
      municipios: [],
    });
  });
  it('indica os municípios gravados que sairão ao escolher sem prova', () => {
    expect(
      municipiosQueSeraoRemovidos(escolherProvaPresencial(declaracao, false), declaracao),
    ).toEqual([municipio]);
    expect(municipiosQueSeraoRemovidos(declaracao, declaracao)).toEqual([]);
    expect(
      municipiosQueSeraoRemovidos({ ...declaracao, temProvaPresencial: null }, declaracao),
    ).toEqual([]);
  });
  it('indica o município gravado que sairá ao remover só ele, mantendo a prova', () => {
    const outro = { codigoIbge: '1500800', uf: 'PA', nome: 'Outra cidade fictícia' };
    const gravada = { ...declaracao, municipios: [municipio, outro] };

    expect(
      municipiosQueSeraoRemovidos(semMunicipio(gravada, municipio.codigoIbge), gravada),
    ).toEqual([municipio]);
    expect(municipiosQueSeraoRemovidos(comMunicipioAdicionado(gravada, outro), gravada)).toEqual(
      [],
    );
  });

  it('apresenta o aviso de remoção no singular', () => {
    expect(avisoDeRemocaoDosMunicipios([municipio])).toBe(
      'O município de prova (Cidade fictícia (PA)) será removido ao salvar.',
    );
  });
  it('apresenta o aviso de remoção no plural', () => {
    expect(avisoDeRemocaoDosMunicipios([municipio, { ...municipio, nome: 'Outra cidade' }])).toBe(
      'Os 2 municípios de prova (Cidade fictícia (PA), Outra cidade (PA)) serão removidos ao salvar.',
    );
  });
  it('apresenta nome e UF no rótulo', () => {
    expect(rotuloDoMunicipio(municipio)).toBe('Cidade fictícia (PA)');
  });
  it('usa código IBGE no rótulo quando o nome é nulo', () => {
    expect(rotuloDoMunicipio({ ...municipio, nome: null })).toBe(
      'município de código 1501402 (PA)',
    );
  });
});
