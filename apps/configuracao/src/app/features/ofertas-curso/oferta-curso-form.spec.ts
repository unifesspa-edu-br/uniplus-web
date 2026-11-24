import { TurnoOfertaCodigo } from '@uniplus/shared-data/configuracao';
import { valoresDaOferta as dadosDaOferta } from './valores-da-oferta.testing';
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
import { marcarRecusaDoServidor } from '../../shared/formulario';

const preenchido = () => {
  const form = criarFormularioDeOferta();
  form.setValue({
    ...OFERTA_EM_BRANCO,
    codigo: 'ENG_CIVIL_MARABA',
    cursoId: 'c',
    localOfertaId: 'l',
    unidadeOfertanteOrigemId: 'u',
    turnos: [TurnoOfertaCodigo.MATUTINO],
  });
  return form;
};

describe('formulário de oferta de curso', () => {
  it('exige o código, os três vínculos, o programa, o formato e os regimes', () => {
    const form = criarFormularioDeOferta();
    expect(form.invalid).toBe(true);
    for (const campo of [
      'codigo',
      'cursoId',
      'localOfertaId',
      'unidadeOfertanteOrigemId',
    ] as const) {
      expect(form.controls[campo].hasError('required'), campo).toBe(true);
    }
    expect(preenchido().valid).toBe(true);
  });

  it.each([
    ['eMecCodigo', 20],
    ['codigoSga', 30],
    ['baseLegal', 500],
    ['atoAutorizacaoMec', 300],
  ] as const)('respeita o tamanho máximo de %s (%i)', (campo, maximo) => {
    const form = preenchido();
    form.controls[campo].setValue('x'.repeat(maximo));
    expect(form.controls[campo].hasError('maxlength')).toBe(false);
    form.controls[campo].setValue('x'.repeat(maximo + 1));
    expect(form.controls[campo].hasError('maxlength')).toBe(true);
  });

  it.each(['ENG_CIVIL_MARABA', 'AB', 'A1', `A${'B'.repeat(49)}`])(
    'aceita o código %s no formato do cadastro',
    (codigo) => {
      const form = preenchido();
      form.controls.codigo.setValue(codigo);
      expect(form.controls.codigo.valid).toBe(true);
    },
  );

  it.each(['A', '1ENG', '_ENG', 'eng_civil', 'ENG-CIVIL', 'ENG CIVIL', 'ENGENHARIA É', ' '])(
    'recusa o código "%s" fora do formato do cadastro',
    (codigo) => {
      const form = preenchido();
      form.controls.codigo.setValue(codigo);
      expect(form.controls.codigo.invalid).toBe(true);
    },
  );

  it('recusa o código acima de 50 caracteres', () => {
    const form = preenchido();
    form.controls.codigo.setValue(`A${'B'.repeat(50)}`);
    expect(form.controls.codigo.hasError('maxlength')).toBe(true);
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
    form.controls.turnos.setValue([TurnoOfertaCodigo.MATUTINO, TurnoOfertaCodigo.MATUTINO]);
    expect(mensagemDeErroDaOferta(form.controls.turnos)).toBe(
      'Os turnos devem ser distintos entre si.',
    );
    form.controls.turnos.setValue([TurnoOfertaCodigo.MATUTINO, TurnoOfertaCodigo.NOTURNO]);
    expect(mensagemDeErroDaOferta(form.controls.turnos)).toBe(
      'O regime selecionado exige exatamente um turno.',
    );
    form.controls.cursoId.setValue('');
    expect(mensagemDeErroDaOferta(form.controls.cursoId)).not.toBeNull();
    form.controls.codigo.setValue('eng civil');
    expect(mensagemDeErroDaOferta(form.controls.codigo)).toContain('Formato inválido.');
    form.controls.codigo.setValue('A'.repeat(51));
    expect(mensagemDeErroDaOferta(form.controls.codigo)).toBe('Informe no máximo 50 caracteres.');
    form.controls.codigo.setValue('');
    expect(mensagemDeErroDaOferta(form.controls.codigo)).toBe('Campo obrigatório.');
    marcarRecusaDoServidor(form.controls.eMecCodigo, 'x', 'Do servidor.');
    expect(mensagemDeErroDaOferta(form.controls.eMecCodigo)).toBe('Do servidor.');
    expect(mensagemDeErroDaOferta(preenchido().controls.codigoSga)).toBeNull();
  });

  it('os valores da oferta trazem a origem da unidade e ordenam os turnos canonicamente', () => {
    const valores = valoresDaOferta({
      ...oferta,
      turnos: [dadosDaOferta.turnos[2], dadosDaOferta.turnos[0]],
      eMecCodigo: null,
      baseLegal: null,
    });
    expect(valores).toMatchObject({
      codigo: oferta.codigo,
      cursoId: oferta.cursoId,
      unidadeOfertanteOrigemId: oferta.unidadeOfertante.origemId,
      turnos: [TurnoOfertaCodigo.MATUTINO, TurnoOfertaCodigo.NOTURNO],
      eMecCodigo: '',
      baseLegal: '',
    });
  });

  it('o comando leva o código aparado, sem espaços nas pontas', () => {
    const valores = { ...valoresDaOferta(oferta), codigo: ' ENG_CIVIL_MARABA ' };
    expect(comandoDeCriacao(valores).codigo).toBe('ENG_CIVIL_MARABA');
    expect(comandoDeAtualizacao('o1', valores).codigo).toBe('ENG_CIVIL_MARABA');
  });

  it('o comando manda nulo no que está em branco e a atualização leva o id sem os vínculos', () => {
    const valores = { ...valoresDaOferta(oferta), eMecCodigo: ' ' };
    const criacao = comandoDeCriacao(valores);
    expect(criacao).toMatchObject({
      codigo: oferta.codigo,
      cursoId: oferta.cursoId,
      eMecCodigo: null,
    });
    const atualizacao = comandoDeAtualizacao('o1', valores);
    expect(atualizacao).toMatchObject({ id: 'o1', codigo: oferta.codigo, eMecCodigo: null });
    expect(Object.keys(atualizacao)).not.toContain('cursoId');
  });

  it('o campo do servidor vira o controle do formulário, inclusive com caminho, e o desconhecido, nulo', () => {
    expect(controleDoCampoDoServidor('eMecCodigo')).toBe('eMecCodigo');
    expect(controleDoCampoDoServidor('Codigo')).toBe('codigo');
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
    for (const recusa of ['codigo_obrigatorio', 'codigo_formato_invalido', 'codigo_ja_em_uso']) {
      expect(controleDoCodigoDoServidor(`${prefixo}${recusa}`), recusa).toBe('codigo');
    }
    expect(controleDoCodigoDoServidor(`${prefixo}e_mec_codigo_tamanho`)).toBeNull();
    expect(controleDoCodigoDoServidor(`${prefixo}outra`)).toBeNull();
    expect(controleDoCodigoDoServidor('uniplus.configuracao.curso.turno_repetido')).toBeNull();
    expect(controleDoCodigoDoServidor(undefined)).toBeNull();
  });
});
