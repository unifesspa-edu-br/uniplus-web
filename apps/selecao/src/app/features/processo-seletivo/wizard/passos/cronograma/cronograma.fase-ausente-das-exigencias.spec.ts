import { describe, expect, it } from 'vitest';
import { detalheDaApi, exigenciaDaApi } from '../../shared/exigencias/exigencias.testing';
import { exigenciasDe } from '../../shared/exigencias/leitura-das-exigencias';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('Documento com fase não encontrada', () => {
  let tela: ContextoDoCronograma;
  usarCronograma((contexto) => {
    tela = contexto;
  });

  it('apresenta o aviso no cronograma', () => {
    const documentos = exigenciasDe(detalheDaApi([exigenciaDaApi({ faseId: 'fase-ausente' })]));
    tela.store.patchObjectSection('documentos', documentos);
    tela.detectar();
    const avisos = Array.from(tela.nativo.querySelectorAll('[role="status"]'));
    expect(
      avisos.some((aviso) => aviso.textContent?.includes('Há documentos exigidos ligados')),
    ).toBe(true);
  });
});
