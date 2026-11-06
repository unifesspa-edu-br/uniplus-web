import { describe, expect, it } from 'vitest';
import {
  OFERTA_EM_BRANCO,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  controleDoCodigoDoServidor,
  criarFormularioDeOferta,
  mensagemDeErroDaOferta,
  valoresDaOferta,
} from './oferta-curso-form';
import { oferta } from './ofertas-curso.testing';

const preenchido = () => {
  const form = criarFormularioDeOferta();
  form.setValue({
    ...OFERTA_EM_BRANCO,
    cursoId: 'c',
    localOfertaId: 'l',
    unidadeOfertanteOrigemId: 'u',
    turnos: ['MATUTINO'],
  });
  return form;
};

describe('formulário de oferta de curso', () => {
  it('exige os três vínculos, o programa, o formato e os regimes', () => {
    const form = criarFormularioDeOferta();
    expect(form.invalid).toBe(true);
    for (const campo of ['cursoId', 'localOfertaId', 'unidadeOfertanteOrigemId'] as const) {
      expect(form.controls[campo].hasError('required'), campo).toBe(true);
    }
    expect(preenchido().valid).toBe(true);

    for (const campo of [
      'programaDeOferta',
      'formatoPedagogico',
      'regimeDeTurno',
      'regimeDeFuncionamento',
    ] as const) {
      const form = preenchido();
      form.controls[campo].setValue('');
      expect(form.controls[campo].hasError('required'), campo).toBe(true);
    }
  });

  it.each([
    ['eMecCodigo', 20],
    ['codigoSga', 30],
    ['baseLegal', 500],
    ['atoAutorizacaoMec', 300],
    ['regimeDeFuncionamento', 30],
  ] as const)('respeita o tamanho máximo de %s (%i)', (campo, maximo) => {
    const form = preenchido();
    form.controls[campo].setValue('x'.repeat(maximo));
    expect(form.controls[campo].hasError('maxlength')).toBe(false);
    form.controls[campo].setValue('x'.repeat(maximo + 1));
    expect(form.controls[campo].hasError('maxlength')).toBe(true);
  });

  it('recusa vagas negativas e aceita zero e vazio', () => {
    const form = preenchido();
    form.controls.vagasAnuaisAutorizadas.setValue(-1);
    expect(form.controls.vagasAnuaisAutorizadas.hasError('min')).toBe(true);
    form.controls.vagasAnuaisAutorizadas.setValue(0);
    expect(form.controls.vagasAnuaisAutorizadas.valid).toBe(true);
    form.controls.vagasAnuaisAutorizadas.setValue(null);
    expect(form.controls.vagasAnuaisAutorizadas.valid).toBe(true);
  });

  it('traduz cada erro em mensagem em português, e a do servidor prevalece', () => {
    const form = preenchido();
    form.markAllAsTouched();
    form.controls.vagasAnuaisAutorizadas.setValue(-1);
    expect(mensagemDeErroDaOferta(form.controls.vagasAnuaisAutorizadas)).toBe(
      'Valor não pode ser negativo.',
    );
    form.controls.turnos.setValue([]);
    expect(mensagemDeErroDaOferta(form.controls.turnos)).toBe(
      'Marque ao menos um turno — nenhum formato pedagógico dispensa o turno.',
    );
    form.controls.turnos.setValue(['MATUTINO', 'MATUTINO']);
    expect(mensagemDeErroDaOferta(form.controls.turnos)).toBe(
      'Os turnos devem ser distintos entre si.',
    );
    form.controls.turnos.setValue(['MATUTINO', 'NOTURNO']);
    expect(mensagemDeErroDaOferta(form.controls.turnos)).toBe(
      'O regime REGULAR exige exatamente um turno.',
    );
    form.controls.regimeDeFuncionamento.setValue('x'.repeat(31));
    expect(mensagemDeErroDaOferta(form.controls.regimeDeFuncionamento)).toBe(
      'Informe no máximo 30 caracteres.',
    );
    form.controls.cursoId.setValue('');
    expect(mensagemDeErroDaOferta(form.controls.cursoId)).not.toBeNull();
    form.controls.eMecCodigo.setErrors({ backend: { code: 'x', message: 'Do servidor.' } });
    expect(mensagemDeErroDaOferta(form.controls.eMecCodigo)).toBe('Do servidor.');
    expect(mensagemDeErroDaOferta(preenchido().controls.codigoSga)).toBeNull();
  });

  it('os valores da oferta trazem a origem da unidade e ordenam os turnos canonicamente', () => {
    const valores = valoresDaOferta({
      ...oferta,
      turnos: ['NOTURNO', 'MATUTINO'],
      eMecCodigo: null,
      baseLegal: null,
    });
    expect(valores).toMatchObject({
      cursoId: oferta.cursoId,
      unidadeOfertanteOrigemId: oferta.unidadeOfertante.origemId,
      turnos: ['MATUTINO', 'NOTURNO'],
      eMecCodigo: '',
      baseLegal: '',
    });
  });

  it('o comando manda nulo no que está em branco e a atualização leva o id sem os vínculos', () => {
    const valores = { ...valoresDaOferta(oferta), eMecCodigo: ' ', regimeDeFuncionamento: '' };
    const criacao = comandoDeCriacao(valores);
    expect(criacao).toMatchObject({
      cursoId: oferta.cursoId,
      eMecCodigo: null,
      regimeDeFuncionamento: null,
    });
    const atualizacao = comandoDeAtualizacao('o1', valores);
    expect(atualizacao).toMatchObject({ id: 'o1', eMecCodigo: null });
    expect(Object.keys(atualizacao)).not.toContain('cursoId');
  });

  it('o campo do servidor vira o controle do formulário, inclusive com caminho, e o desconhecido, nulo', () => {
    expect(controleDoCampoDoServidor('eMecCodigo')).toBe('eMecCodigo');
    expect(controleDoCampoDoServidor('Turnos')).toBe('turnos');
    expect(controleDoCampoDoServidor('cursoId')).toBeNull();
    expect(controleDoCampoDoServidor('Outro')).toBeNull();
  });

  it('o código do domínio vira o controle do formulário, e o desconhecido ou alheio, nulo', () => {
    const prefixo = 'uniplus.configuracao.oferta_curso.';
    expect(controleDoCodigoDoServidor(`${prefixo}curso_inexistente_ou_removido`)).toBe('cursoId');
    expect(controleDoCodigoDoServidor(`${prefixo}unidade_ofertante_inexistente`)).toBe(
      'unidadeOfertanteOrigemId',
    );
    expect(controleDoCodigoDoServidor(`${prefixo}e_mec_codigo_tamanho`)).toBeNull();
    expect(controleDoCodigoDoServidor(`${prefixo}outra`)).toBeNull();
    expect(controleDoCodigoDoServidor('uniplus.configuracao.curso.turno_repetido')).toBeNull();
    expect(controleDoCodigoDoServidor(undefined)).toBeNull();
  });
});
