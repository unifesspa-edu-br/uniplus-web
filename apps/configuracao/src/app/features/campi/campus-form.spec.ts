import { describe, expect, it } from 'vitest';
import { CampusDto } from '@uniplus/shared-data/configuracao';
import {
  CAMPUS_EM_BRANCO,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeCampus,
  valoresDoCampus,
} from './campus-form';

const campus: CampusDto = {
  id: '01960000-0000-7000-0000-0000000000b1',
  sigla: 'MARABA',
  nome: 'Campus de Marabá',
  codigoEmec: null,
  cidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  endereco: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('formulário de campus', () => {
  it('sem código e-MEC, o formulário traz o campo vazio e o comando o envia nulo', () => {
    const valores = valoresDoCampus(campus);

    expect(valores.codigoEmec).toBe('');
    expect(comandoDeCriacao(valores).codigoEmec).toBeNull();
  });

  it('o comando de atualização leva o id e a cidade do endereço escolhido', () => {
    const comando = comandoDeAtualizacao(campus.id, valoresDoCampus(campus));

    expect(comando).toMatchObject({ id: campus.id, sigla: 'MARABA', cidadeCodigoIbge: '1504208' });
  });

  it('o formulário em branco é inválido: sigla e nome são obrigatórios', () => {
    const form = criarFormularioDeCampus();
    form.reset(CAMPUS_EM_BRANCO);

    expect(form.controls.sigla.hasError('required')).toBe(true);
    expect(form.controls.nome.hasError('required')).toBe(true);
  });

  it('só os campos digitados correspondem a uma recusa do servidor', () => {
    expect(controleDoCampoDoServidor('CodigoEmec')).toBe('codigoEmec');
    expect(controleDoCampoDoServidor('Endereco.Cep')).toBeNull();
  });
});
