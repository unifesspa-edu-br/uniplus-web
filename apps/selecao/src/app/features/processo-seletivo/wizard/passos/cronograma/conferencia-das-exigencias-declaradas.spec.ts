import { describe, expect, it } from 'vitest';
import { problemasDoCronograma } from './cronograma-do-certame';
import { avisosDosGrupos } from './conferencia-das-exigencias-declaradas';
import {
  exigenciaDeclarada,
  faseDeAvaliacao,
  catalogosDeTeste,
} from './cronograma-do-certame.testing';

describe('o que a publicação vai cobrar dos grupos', () => {
  /**
   * Aviso, não impedimento. A norma de um grupo não se edita no wizard — bloquear a gravação
   * por causa dela prenderia o passo sem saída, e a única fuga seria remover os documentos do
   * grupo um a um até ele desaparecer, destruindo a configuração. Quem recusa é a publicação.
   */
  it('avisa sobre o grupo que decide o resultado sem norma, nomeando o que ele reúne', () => {
    const avisos = avisosDosGrupos([
      { decideResultado: true, normaResolvida: false, documentos: ['Contracheque', 'Extrato'] },
    ]);

    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('Contracheque, Extrato');
    expect(avisos[0]).toContain('A publicação vai cobrá-la.');
  });

  it('não avisa sobre grupo com norma resolvida nem sobre grupo transparente', () => {
    expect(
      avisosDosGrupos([
        { decideResultado: true, normaResolvida: true, documentos: ['Contracheque'] },
        { decideResultado: false, normaResolvida: false, documentos: ['Extrato'] },
      ]),
    ).toEqual([]);
  });

  /** Sem documentos nomeáveis a frase não pode terminar em "reúne ." */
  it('avisa mesmo quando não há documento a nomear', () => {
    const avisos = avisosDosGrupos([
      { decideResultado: true, normaResolvida: false, documentos: [] },
    ]);

    expect(avisos[0]).not.toContain('reúne');
    expect(avisos[0]).toContain('A publicação vai cobrá-la.');
  });
});

describe('conferência da ancoragem das exigências declaradas', () => {
  it('exigência que decide o resultado sem norma resolvida é acusada antes de gravar', () => {
    const problemas = problemasDoCronograma({
      fases: [faseDeAvaliacao],
      etapas: [],
      exigencias: [
        exigenciaDeclarada({ nome: 'Histórico do ensino médio', decideResultado: true }),
      ],
      catalogos: catalogosDeTeste(),
    });

    expect(problemas).toContainEqual(expect.stringContaining('Histórico do ensino médio'));
    expect(problemas).toContainEqual(expect.stringContaining('norma'));
  });

  it('acusa a exigência cuja fase saiu do cronograma, nomeando o documento', () => {
    const problemas = problemasDoCronograma({
      fases: [faseDeAvaliacao],
      etapas: [],
      exigencias: [exigenciaDeclarada({ nome: 'Comprovante de renda', faseViva: false })],
      catalogos: catalogosDeTeste(),
    });

    expect(problemas).toContainEqual(expect.stringContaining('saiu do cronograma'));
    expect(problemas).toContainEqual(expect.stringContaining('Comprovante de renda'));
  });

  it('acusa a exigência que não alcança modalidade nenhuma', () => {
    const problemas = problemasDoCronograma({
      fases: [faseDeAvaliacao],
      etapas: [],
      exigencias: [exigenciaDeclarada({ alcancaModalidade: false })],
      catalogos: catalogosDeTeste(),
    });

    expect(problemas).toContainEqual(expect.stringContaining('modalidade'));
  });

  /** Exigência já acusada de órfã não é acusada de novo por não alcançar modalidade. */
  it('não repete a queixa de modalidade sobre exigência de fase morta', () => {
    const problemas = problemasDoCronograma({
      fases: [faseDeAvaliacao],
      etapas: [],
      exigencias: [exigenciaDeclarada({ faseViva: false, alcancaModalidade: false })],
      catalogos: catalogosDeTeste(),
    });

    expect(problemas).not.toContainEqual(expect.stringContaining('modalidade'));
  });

  it('acusa a exigência sem o formulário em que o documento é apresentado, nomeando o documento', () => {
    const problemas = problemasDoCronograma({
      fases: [faseDeAvaliacao],
      etapas: [],
      exigencias: [exigenciaDeclarada({ nome: 'Comprovante de renda', semFormulario: true })],
      catalogos: catalogosDeTeste(),
    });

    expect(problemas).toContainEqual(
      'Há documento exigido sem o formulário em que o candidato o apresenta: Comprovante de renda. Na fase dele, escolha o formulário.',
    );
  });

  it('acusa o reenvio declarado em fase que não admite complementação', () => {
    const problemas = problemasDoCronograma({
      fases: [faseDeAvaliacao],
      etapas: [],
      exigencias: [exigenciaDeclarada({ nome: 'Contracheque', reenvioSemComplementacao: true })],
      catalogos: catalogosDeTeste(),
    });

    expect(problemas).toContainEqual(expect.stringContaining('complementação'));
    expect(problemas).toContainEqual(expect.stringContaining('Contracheque'));
  });

  it('acusa a condição que cita dado ainda não conhecido na fase, com o que fazer', () => {
    const orientacao =
      '“Laudo” só é conhecido na fase Habilitação. Como resolver: exija o documento na fase Habilitação.';
    const problemas = problemasDoCronograma({
      fases: [faseDeAvaliacao],
      etapas: [],
      exigencias: [exigenciaDeclarada({ nome: 'Laudo médico', problemasDeFase: [orientacao] })],
      catalogos: catalogosDeTeste(),
    });

    expect(problemas).toContain(`Na condição de "Laudo médico": ${orientacao}`);
  });

  /** Controle negativo: exigência conforme não produz nenhuma das três queixas. */
  it('exigência ancorada, com modalidade e sem reenvio indevido não é acusada', () => {
    const problemas = problemasDoCronograma({
      fases: [faseDeAvaliacao],
      etapas: [],
      exigencias: [exigenciaDeclarada({ normaResolvida: true })],
      catalogos: catalogosDeTeste(),
    });

    expect(problemas).not.toContainEqual(expect.stringContaining('saiu do cronograma'));
    expect(problemas).not.toContainEqual(expect.stringContaining('modalidade'));
    expect(problemas).not.toContainEqual(expect.stringContaining('complementação'));
  });

  it('exigência que não decide o resultado segue sem norma', () => {
    const problemas = problemasDoCronograma({
      fases: [faseDeAvaliacao],
      etapas: [],
      exigencias: [exigenciaDeclarada({ nome: 'Foto 3x4', decideResultado: false })],
      catalogos: catalogosDeTeste(),
    });

    expect(problemas).not.toContainEqual(expect.stringContaining('norma'));
  });
});
