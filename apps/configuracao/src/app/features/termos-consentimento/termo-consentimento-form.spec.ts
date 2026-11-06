import { describe, expect, it } from 'vitest';
import {
  BASE_LEGAL_MAX,
  FORMA_ACEITE_DEFAULT,
  NOME_MAX,
  TEXTO_MAX,
  comandoDeCriacao,
  comandoDeRascunho,
  controleDoCampoDoServidor,
  criarFormulario,
  criarFormularioRascunho,
  valoresDoRascunho,
} from './termo-consentimento-form';
import { termo } from './termos-consentimento.testing';

describe('formulário de criação do termo', () => {
  it('exige o nome e limita nome, texto e base legal', () => {
    const form = criarFormulario();
    expect(form.controls.nome.hasError('required')).toBe(true);
    expect(form.controls.formaAceite.value).toBe(FORMA_ACEITE_DEFAULT);
    form.controls.nome.setValue('x'.repeat(NOME_MAX + 1));
    form.controls.texto.setValue('x'.repeat(TEXTO_MAX + 1));
    form.controls.baseLegal.setValue('x'.repeat(BASE_LEGAL_MAX + 1));
    for (const controle of [form.controls.nome, form.controls.texto, form.controls.baseLegal]) {
      expect(controle.hasError('maxlength')).toBe(true);
    }
    form.controls.nome.setValue('Termo');
    form.controls.texto.setValue('');
    form.controls.baseLegal.setValue('');
    expect(form.valid).toBe(true);
  });

  it('prepara o comando com os textos aparados e os vazios como ausência', () => {
    const form = criarFormulario();
    form.setValue({ nome: ' Termo ', texto: '  ', baseLegal: ' Lei ', formaAceite: 'A_DEFINIR' });
    expect(comandoDeCriacao(form)).toEqual({
      nome: 'Termo',
      textoRascunho: null,
      baseLegalRascunho: 'Lei',
      formaAceiteRascunho: 'A_DEFINIR',
    });
  });
});

describe('formulário do rascunho', () => {
  it('traz do termo os valores em branco quando o servidor não os tem', () => {
    expect(valoresDoRascunho(termo({ textoRascunho: null, baseLegalRascunho: null }))).toEqual({
      texto: '',
      baseLegal: '',
      formaAceite: 'A_DEFINIR',
    });
  });

  it('prepara o comando de edição com o id do termo', () => {
    const form = criarFormularioRascunho();
    form.setValue({ texto: ' Texto ', baseLegal: '', formaAceite: 'REGISTRO_DIGITAL_COM_LOG_IP' });
    expect(comandoDeRascunho('t1', form)).toEqual({
      id: 't1',
      textoRascunho: 'Texto',
      baseLegalRascunho: null,
      formaAceiteRascunho: 'REGISTRO_DIGITAL_COM_LOG_IP',
    });
  });
});

describe('controleDoCampoDoServidor', () => {
  it.each([
    ['Nome', 'nome'],
    ['TextoRascunho', 'texto'],
    ['baseLegalRascunho', 'baseLegal'],
    ['Command.FormaAceiteRascunho', 'formaAceite'],
  ])('leva %s ao controle %s', (campo, controle) => {
    expect(controleDoCampoDoServidor(campo)).toBe(controle);
  });

  it('devolve null para campo que o formulário não tem', () => {
    expect(controleDoCampoDoServidor('Inexistente')).toBeNull();
  });
});
