import { ReferenciaReservaDemograficaDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import {
  RESERVA_EM_BRANCO,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeReserva,
  mensagemDoCampo,
  valoresDaReserva,
} from './reserva-demografica-form';

const referencia: ReferenciaReservaDemograficaDto = {
  id: 'r1',
  censoReferencia: '2022',
  ppiPercentual: 78.5,
  quilombolaPercentual: 1.2,
  pcdPercentual: 8.4,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
  criadoEm: '',
};

describe('formulário de reserva demográfica', () => {
  it('aceita os limites de 0 e 100 e recusa o que está fora da faixa ou em branco', () => {
    const form = criarFormularioDeReserva();
    expect(form.invalid).toBe(true);
    form.reset(valoresDaReserva(referencia));
    expect(form.valid).toBe(true);
    for (const valor of [0, 100]) {
      form.controls.ppiPercentual.setValue(valor);
      expect(form.controls.ppiPercentual.valid).toBe(true);
    }
    for (const valor of [-1, 100.01, null]) {
      form.controls.ppiPercentual.setValue(valor);
      expect(form.controls.ppiPercentual.invalid).toBe(true);
    }
  });

  it('prepara os comandos sem os brancos, com o id só na atualização', () => {
    const valores = { ...valoresDaReserva(referencia), censoReferencia: ' 2022 ', baseLegal: ' ' };
    expect(comandoDeCriacao(valores)).toEqual({
      censoReferencia: '2022',
      ppiPercentual: 78.5,
      quilombolaPercentual: 1.2,
      pcdPercentual: 8.4,
      baseLegal: null,
    });
    expect(comandoDeAtualizacao('r1', valores)).toMatchObject({
      id: 'r1',
      censoReferencia: '2022',
    });
    expect(comandoDeCriacao(RESERVA_EM_BRANCO)).toMatchObject({
      censoReferencia: null,
      ppiPercentual: 0,
    });
  });

  it('converte o campo recusado pelo servidor no controle do formulário', () => {
    expect(controleDoCampoDoServidor('PpiPercentual')).toBe('ppiPercentual');
    expect(controleDoCampoDoServidor('Desconhecido')).toBeNull();
  });

  describe('mensagem do campo', () => {
    const form = criarFormularioDeReserva();
    const tocar = (nome: 'censoReferencia' | 'ppiPercentual', valor: string | number | null) => {
      const controle = form.controls[nome];
      controle.setValue(valor as never);
      controle.markAsTouched();
      return mensagemDoCampo(controle);
    };

    it('não mostra erro antes de o campo ser tocado', () => {
      expect(mensagemDoCampo(form.controls.censoReferencia)).toBeNull();
    });

    it('diz a obrigatoriedade, a faixa e o tamanho', () => {
      expect(tocar('censoReferencia', '')).toBe('Campo obrigatório.');
      expect(tocar('censoReferencia', '1'.repeat(21))).toBe('Informe no máximo 20 caracteres.');
      expect(tocar('ppiPercentual', 101)).toBe('Informe um valor entre 0 e 100.');
      expect(tocar('ppiPercentual', -1)).toBe('Informe um valor entre 0 e 100.');
      expect(tocar('ppiPercentual', 50)).toBeNull();
    });

    it('a duplicidade e a recusa do servidor valem mais que as regras locais', () => {
      const censo = form.controls.censoReferencia;
      censo.setErrors({ duplicado: true });
      censo.markAsTouched();
      expect(mensagemDoCampo(censo)).toBe('Já existe uma referência ativa para este Censo.');
      censo.setErrors({ backend: { code: 'x', message: 'Recusado.' } });
      expect(mensagemDoCampo(censo)).toBe('Recusado.');
    });
  });
});
