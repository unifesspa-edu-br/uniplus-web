import { PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import {
  MENSAGEM_DE_AUTORREFERENCIA,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDePrecedencia,
  descartarErroDoPar,
  mensagemDaSucessora,
  valoresDaPrecedencia,
  valoresEmBrancoDaPrecedencia,
} from './precedencia-form';

const aresta: PrecedenciaFaseDto = {
  id: 'a1',
  antecessoraCodigo: 'INSCRICAO',
  sucessoraCodigo: 'HOMOLOGACAO',
  permiteSobreposicao: true,
  criadoEm: '',
};

describe('formulário de precedência de fase', () => {
  it('nasce inválido, sem sobreposição, e exige as duas fases', () => {
    const form = criarFormularioDePrecedencia();
    form.reset(valoresEmBrancoDaPrecedencia());
    expect(form.invalid).toBe(true);
    expect(form.controls.permiteSobreposicao.value).toBe(false);
    form.patchValue({ antecessoraCodigo: 'INSCRICAO' });
    expect(form.invalid).toBe(true);
    form.patchValue({ sucessoraCodigo: 'HOMOLOGACAO' });
    expect(form.valid).toBe(true);
  });

  it('barra o par com a mesma fase nos dois lados', () => {
    const form = criarFormularioDePrecedencia();
    form.reset({ ...valoresEmBrancoDaPrecedencia(), antecessoraCodigo: 'AVALIACAO' });
    form.patchValue({ sucessoraCodigo: 'AVALIACAO' });
    expect(form.hasError('selfLoop')).toBe(true);
    form.controls.sucessoraCodigo.markAsTouched();
    expect(mensagemDaSucessora(form)).toBe(MENSAGEM_DE_AUTORREFERENCIA);
    form.patchValue({ sucessoraCodigo: 'CLASSIFICACAO' });
    expect(form.hasError('selfLoop')).toBe(false);
    expect(mensagemDaSucessora(form)).toBeNull();
  });

  it('só mostra a mensagem da sucessora depois de tocada', () => {
    const form = criarFormularioDePrecedencia();
    form.reset(valoresEmBrancoDaPrecedencia());
    expect(mensagemDaSucessora(form)).toBeNull();
    form.controls.sucessoraCodigo.markAsTouched();
    expect(mensagemDaSucessora(form)).toBe('Campo obrigatório.');
  });

  it('carrega a aresta no formulário e monta os comandos sem vazar campo', () => {
    const form = criarFormularioDePrecedencia();
    form.reset(valoresDaPrecedencia(aresta));
    expect(form.getRawValue()).toEqual({
      antecessoraCodigo: 'INSCRICAO',
      sucessoraCodigo: 'HOMOLOGACAO',
      permiteSobreposicao: true,
    });
    expect(comandoDeCriacao(form)).toEqual({
      antecessoraCodigo: 'INSCRICAO',
      sucessoraCodigo: 'HOMOLOGACAO',
      permiteSobreposicao: true,
    });
    expect(comandoDeAtualizacao('a1', form)).toEqual({ id: 'a1', permiteSobreposicao: true });
  });

  it('reconhece o campo do servidor em PascalCase e ignora o que o formulário não tem', () => {
    expect(controleDoCampoDoServidor('SucessoraCodigo')).toBe('sucessoraCodigo');
    expect(controleDoCampoDoServidor('Comando.AntecessoraCodigo')).toBe('antecessoraCodigo');
    expect(controleDoCampoDoServidor('Outro')).toBeNull();
  });

  describe('erro do par devolvido pelo servidor', () => {
    const marcar = (code: string) => {
      const form = criarFormularioDePrecedencia();
      form.reset({
        ...valoresEmBrancoDaPrecedencia(),
        antecessoraCodigo: 'A',
        sucessoraCodigo: 'B',
      });
      form.controls.sucessoraCodigo.setErrors({ backend: { code, message: 'Recusa.' } });
      return form;
    };

    it('some quando a antecessora é corrigida', () => {
      const form = marcar('uniplus.configuracao.precedencia_fase.aresta_duplicada');
      descartarErroDoPar(form);
      expect(form.controls.sucessoraCodigo.errors).toBeNull();
    });

    it('não apaga a recusa de uma fase isolada', () => {
      const form = marcar(
        'uniplus.configuracao.precedencia_fase.sucessora_fora_do_conjunto_canonico',
      );
      descartarErroDoPar(form);
      expect(form.controls.sucessoraCodigo.errors).not.toBeNull();
    });
  });
});
