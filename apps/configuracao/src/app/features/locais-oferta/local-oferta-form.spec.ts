import { describe, expect, it } from 'vitest';
import { LocalOfertaDto } from '@uniplus/shared-data/configuracao';
import { TIPO_LOCAL_DE_TESTE } from './locais-oferta.testing';
import {
  LOCAL_EM_BRANCO,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeLocalOferta,
  valoresDoLocal,
} from './local-oferta-form';

const local: LocalOfertaDto = {
  id: 'local-1',
  tipo: TIPO_LOCAL_DE_TESTE,
  codigoEmec: null,
  campusResponsavelId: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('formulário de local de oferta', () => {
  it('sem código e-MEC nem campus, o formulário traz os campos vazios e o comando os envia nulos', () => {
    const valores = valoresDoLocal(local);

    expect(valores).toMatchObject({ codigoEmec: '', campusResponsavelId: '' });
    expect(comandoDeCriacao(valores)).toMatchObject({
      codigoEmec: null,
      campusResponsavelId: null,
    });
  });

  it('o comando de atualização leva o id, o tipo e a cidade do endereço escolhido', () => {
    const comando = comandoDeAtualizacao(local.id, valoresDoLocal(local));

    expect(comando).toMatchObject({
      id: local.id,
      tipo: TIPO_LOCAL_DE_TESTE.codigo,
      cidadeCodigoIbge: '1504208',
    });
  });

  it('o formulário em branco é inválido: tipo e cidade são obrigatórios', () => {
    const form = criarFormularioDeLocalOferta();
    form.reset(LOCAL_EM_BRANCO);

    expect(form.controls.tipo.hasError('required')).toBe(true);
    expect(form.controls.endereco.hasError('cidadeObrigatoria')).toBe(true);
  });

  it('só os campos digitados correspondem a uma recusa do servidor', () => {
    expect(controleDoCampoDoServidor('CampusResponsavelId')).toBe('campusResponsavelId');
    expect(controleDoCampoDoServidor('Endereco.Cep')).toBeNull();
  });
});
