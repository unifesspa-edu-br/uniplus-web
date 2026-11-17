import { describe, expect, it } from 'vitest';
import { distribuirRecusaDaPublicacao } from './recusa-da-publicacao';

describe('distribuirRecusaDaPublicacao', () => {
  it('começa o resumo pelo motivo e põe a causa geral depois dele', () => {
    const recusa = distribuirRecusaDaPublicacao('Dados inválidos', [
      { code: 'Ato.Bloqueado', message: 'O processo não aceita novos atos.' },
    ]);

    expect(recusa.mensagens).toEqual(['Dados inválidos', 'O processo não aceita novos atos.']);
    expect(recusa.dosCampos.size).toBe(0);
  });

  it('o campo vazio da raiz não tem controle e vai ao resumo', () => {
    const recusa = distribuirRecusaDaPublicacao('Dados inválidos', [
      { field: '', code: 'Pedido.Invalido', message: 'O pedido está incompleto.' },
    ]);

    expect(recusa.mensagens).toContain('O pedido está incompleto.');
    expect(recusa.dosCampos.size).toBe(0);
  });

  it('leva ao controle a mensagem do campo que a tela tem', () => {
    const recusa = distribuirRecusaDaPublicacao('Dados inválidos', [
      { field: 'Assinante', code: 'maxlength', message: 'Assinante longo demais.' },
    ]);

    expect(recusa.dosCampos.get('assinante')).toBe('Assinante longo demais.');
    expect(recusa.mensagens).toEqual(['Dados inválidos']);
  });

  it('sem causas, o resumo traz só o motivo', () => {
    expect(distribuirRecusaDaPublicacao('Falhou', undefined).mensagens).toEqual(['Falhou']);
  });
});
