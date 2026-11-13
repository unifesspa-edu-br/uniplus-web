import { describe, expect, it } from 'vitest';
import {
  MOTIVO_EM_BRANCO,
  ajustarAoModo,
  comandoDeAtualizacao,
  comandoDeCriacao,
  controleDoCampoDoServidor,
  criarFormularioDeMotivo,
  valoresDoMotivo,
} from './motivo-de-decisao-form';
import { isencao } from './motivos-de-decisao.testing';
import {
  rotuloDe,
  SENTIDOS_DE_MOTIVO,
  TIPOS_DE_MOTIVO,
  tipoPedeSubclassificacao,
} from './tipos-de-motivo';

describe('formulário de motivo de decisão', () => {
  it('na criação, todos os campos valem e só o código e a descrição são validados pelo tamanho', () => {
    const form = criarFormularioDeMotivo();
    ajustarAoModo(form, 'criar', false);
    form.reset({ ...MOTIVO_EM_BRANCO, codigo: 'a', descricao: 'ab' });

    expect(form.controls.codigo.hasError('minlength')).toBe(true);
    expect(form.controls.descricao.hasError('minlength')).toBe(true);
    expect(form.controls.sentido.hasError('required')).toBe(true);
    expect(form.controls.subclassificacao.disabled).toBe(true);
  });

  it('o código aceita só letras maiúsculas, números e sublinhado, iniciando por letra', () => {
    const form = criarFormularioDeMotivo();
    form.controls.codigo.setValue('sem_resultado');
    expect(form.controls.codigo.hasError('pattern')).toBe(true);
    form.controls.codigo.setValue('SEM_RESULTADO_NO_ENEM');
    expect(form.controls.codigo.valid).toBe(true);
  });

  it('o tipo que pede subclassificação a torna obrigatória na criação', () => {
    const form = criarFormularioDeMotivo();
    ajustarAoModo(form, 'criar', true);

    expect(form.controls.subclassificacao.enabled).toBe(true);
    expect(form.controls.subclassificacao.hasError('required')).toBe(true);
  });

  it('na edição só a descrição muda: código, sentido e subclassificação ficam desabilitados', () => {
    const form = criarFormularioDeMotivo();
    form.reset(valoresDoMotivo(isencao));
    ajustarAoModo(form, 'editar', true);

    expect(form.controls.codigo.disabled).toBe(true);
    expect(form.controls.sentido.disabled).toBe(true);
    expect(form.controls.subclassificacao.disabled).toBe(true);
    expect(form.controls.descricao.enabled).toBe(true);
    expect(form.getRawValue().codigo).toBe(isencao.codigo);
  });

  it('o comando de criação leva o tipo e troca texto em branco por nulo', () => {
    const comando = comandoDeCriacao('CLASSIFICACAO', {
      ...MOTIVO_EM_BRANCO,
      codigo: 'NOTA_INSUFICIENTE',
      sentido: 'DESFAVORAVEL',
      descricao: 'Nota abaixo do mínimo.',
    });

    expect(comando).toEqual({
      tipo: 'CLASSIFICACAO',
      codigo: 'NOTA_INSUFICIENTE',
      descricao: 'Nota abaixo do mínimo.',
      subclassificacao: null,
      sentido: 'DESFAVORAVEL',
    });
  });

  it('o comando de atualização leva só o id e a descrição', () => {
    expect(comandoDeAtualizacao(isencao.id, valoresDoMotivo(isencao))).toEqual({
      id: isencao.id,
      descricao: isencao.descricao,
    });
  });

  it('mapeia os campos que o servidor recusa para os controles do formulário', () => {
    expect(controleDoCampoDoServidor('Codigo')).toBe('codigo');
    expect(controleDoCampoDoServidor('Subclassificacao')).toBe('subclassificacao');
    expect(controleDoCampoDoServidor('Outro')).toBeNull();
  });

  it('só a isenção pede subclassificação, e os seis tipos têm nome em português', () => {
    expect(TIPOS_DE_MOTIVO.filter((t) => tipoPedeSubclassificacao(t.codigo))).toHaveLength(1);
    expect(TIPOS_DE_MOTIVO).toHaveLength(6);
    expect(rotuloDe(SENTIDOS_DE_MOTIVO, 'FAVORAVEL')).toBe('Favorável ao candidato');
    expect(rotuloDe(SENTIDOS_DE_MOTIVO, 'DESCONHECIDO')).toBe('DESCONHECIDO');
  });
});
