import { localizarCampo } from './formulario-do-candidato.model';
import {
  FORMULARIO_COM_GRUPO_DA_FAMILIA,
  FORMULARIO_COM_TERMO_DE_VERACIDADE,
  FORMULARIO_DE_ENDERECO_COM_ALDEIA,
} from './formularios-de-exemplo.testing';

describe('localizarCampo', () => {
  it('devolve o rótulo do dado que o formulário coleta', () => {
    const dado = FORMULARIO_DE_ENDERECO_COM_ALDEIA.coleta.itens[0];

    expect(localizarCampo(FORMULARIO_DE_ENDERECO_COM_ALDEIA, dado.fatoCodigo)).toBe(
      dado.apresentacao.rotulo,
    );
  });

  it('devolve o rótulo do grupo para o grupo, a ocorrência e o dado da ocorrência', () => {
    expect(localizarCampo(FORMULARIO_COM_GRUPO_DA_FAMILIA, 'FAMILIA')).toBe('Integrante');
    expect(localizarCampo(FORMULARIO_COM_GRUPO_DA_FAMILIA, 'FAMILIA.o1')).toBe('Integrante');
    expect(localizarCampo(FORMULARIO_COM_GRUPO_DA_FAMILIA, 'FAMILIA.o1.RENDA')).toBe('Integrante');
  });

  it('devolve o nome do termo pelo código dele nas regras, não pelo código do termo', () => {
    expect(localizarCampo(FORMULARIO_COM_TERMO_DE_VERACIDADE, 'Inscricao:VERACIDADE')).toBe(
      'Veracidade',
    );
    expect(localizarCampo(FORMULARIO_COM_TERMO_DE_VERACIDADE, 'VERACIDADE')).toBeNull();
  });

  it('devolve nulo para o campo que o formulário não tem', () => {
    expect(localizarCampo(FORMULARIO_COM_GRUPO_DA_FAMILIA, 'FAMILIAR')).toBeNull();
    expect(localizarCampo(FORMULARIO_COM_GRUPO_DA_FAMILIA, 'OUTRO_DADO')).toBeNull();
  });
});
