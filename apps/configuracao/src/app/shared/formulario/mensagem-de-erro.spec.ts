import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { mensagemDeErroDoCampoComFormato, mensagemDeErroDoControle } from './mensagem-de-erro';
import { marcarRecusaDoServidor } from './recusa-do-servidor';

const FORMATO = 'Formato de teste.';

function tocado(erros: Record<string, unknown>): FormControl<string> {
  const controle = new FormControl('x', { nonNullable: true });
  controle.markAsTouched();
  controle.setErrors(erros);
  return controle;
}

describe('mensagem do campo de cadastro com formato', () => {
  it('não mostra mensagem antes de o campo ser tocado', () => {
    const controle = new FormControl('x', { nonNullable: true });
    controle.setErrors({ pattern: {} });
    expect(mensagemDeErroDoCampoComFormato(controle, FORMATO)).toBeNull();
  });

  it('a recusa do servidor e a obrigatoriedade vencem as regras de tamanho e formato', () => {
    const regras = { minlength: { requiredLength: 2 }, pattern: {} };
    const recusado = tocado(regras);
    marcarRecusaDoServidor(recusado, 'c', 'Recusado.');
    recusado.setErrors({ ...recusado.errors, ...regras });
    expect(mensagemDeErroDoCampoComFormato(recusado, FORMATO)).toBe('Recusado.');
    expect(mensagemDeErroDoCampoComFormato(tocado({ ...regras, required: true }), FORMATO)).toBe(
      'Campo obrigatório.',
    );
  });

  it('o tamanho mínimo vence o formato', () => {
    expect(
      mensagemDeErroDoCampoComFormato(
        tocado({ minlength: { requiredLength: 3 }, pattern: {} }),
        FORMATO,
      ),
    ).toBe('Informe ao menos 3 caracteres.');
  });

  it('usa a mensagem de formato recebida, salvo se o tamanho máximo também foi violado', () => {
    expect(mensagemDeErroDoCampoComFormato(tocado({ pattern: {} }), FORMATO)).toBe(FORMATO);
    expect(
      mensagemDeErroDoCampoComFormato(
        tocado({ pattern: {}, maxlength: { requiredLength: 50 } }),
        FORMATO,
      ),
    ).toBe('Informe no máximo 50 caracteres.');
  });

  it('cai na mensagem genérica para outra regra violada', () => {
    expect(mensagemDeErroDoCampoComFormato(tocado({ outra: true }), FORMATO)).toBe(
      'Valor inválido.',
    );
  });
});

describe('mensagem do controle com recusas do servidor', () => {
  it('junta as mensagens das recusas do campo, na ordem recebida', () => {
    const controle = new FormControl('x', { nonNullable: true });
    marcarRecusaDoServidor(controle, 'a', 'Primeira.');
    marcarRecusaDoServidor(controle, 'b', 'Segunda.');

    expect(mensagemDeErroDoControle(controle)).toBe('Primeira. Segunda.');
  });

  it('com uma só recusa, mostra a mensagem dela', () => {
    const controle = new FormControl('x', { nonNullable: true });
    marcarRecusaDoServidor(controle, 'a', 'Única.');

    expect(mensagemDeErroDoControle(controle)).toBe('Única.');
  });
});
