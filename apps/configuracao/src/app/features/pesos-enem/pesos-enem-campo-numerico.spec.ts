import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { mensagemDoCampoNumerico } from './pesos-enem-campo-numerico';
import { criarGrupoDeCriacao } from './pesos-enem-form';
import { AREAS, grupo } from './pesos-enem.testing';

function campo(nome: 'peso' | 'corte') {
  return criarGrupoDeCriacao(grupo('TECNOLOGICA'), AREAS).controls.areas.at(0).controls[nome];
}

describe('mensagem do campo numérico', () => {
  it('não diz nada antes de o campo ser tocado ou editado', () => {
    const peso = campo('peso');
    peso.setValue(-1);
    expect(mensagemDoCampoNumerico(peso, 'peso')).toBeNull();
    peso.markAsTouched();
    expect(mensagemDoCampoNumerico(peso, 'peso')).toBe('O peso não pode ser negativo.');
  });

  it.each([
    ['peso', -1, 'O peso não pode ser negativo.'],
    ['peso', 100, 'O peso não pode exceder 99,99.'],
    ['peso', 1.234, 'O peso aceita no máximo 2 casas decimais.'],
    ['corte', -1, 'O corte não pode ser negativo.'],
    ['corte', 1001, 'O corte não pode exceder 1.000.'],
    ['corte', 1.2345, 'O corte aceita no máximo 3 casas decimais.'],
  ] as const)('%s %s: "%s"', (nome, valor, mensagem) => {
    const controle = campo(nome);
    controle.setValue(valor);
    controle.markAsTouched();
    expect(mensagemDoCampoNumerico(controle, nome)).toBe(mensagem);
  });

  it('o peso vazio é obrigatório, mas o texto ainda incompleto não diz nada', () => {
    const peso = campo('peso');
    peso.setValue(null as unknown as number);
    peso.markAsTouched();
    expect(mensagemDoCampoNumerico(peso, 'peso')).toBe('Campo obrigatório.');
    peso.setErrors({ required: true, digitacaoIncompleta: true });
    expect(mensagemDoCampoNumerico(peso, 'peso')).toBeNull();
  });

  it('o número ilegível é acusado e a recusa do servidor vale mais que a regra local', () => {
    const corte = campo('corte');
    corte.markAsTouched();
    corte.setErrors({ numeroInvalido: true });
    expect(mensagemDoCampoNumerico(corte, 'corte')).toBe('Número inválido.');
    corte.setErrors({
      numeroInvalido: true,
      backend: { code: 'c', message: 'Recusado pelo servidor.' },
    });
    expect(mensagemDoCampoNumerico(corte, 'corte')).toBe('Recusado pelo servidor.');
  });

  it('um erro desconhecido cai na mensagem genérica e um controle válido não tem mensagem', () => {
    const livre = new FormControl(1);
    livre.markAsTouched();
    expect(mensagemDoCampoNumerico(livre, 'peso')).toBeNull();
    livre.setErrors({ qualquer: true });
    expect(mensagemDoCampoNumerico(livre, 'peso')).toBe('Valor inválido.');
  });
});
