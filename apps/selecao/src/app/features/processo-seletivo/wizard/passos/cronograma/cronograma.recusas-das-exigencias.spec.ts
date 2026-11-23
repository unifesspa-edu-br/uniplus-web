import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { exigencia, regraDoRascunho } from '../../shared/exigencias/exigencias.testing';
import { CatalogoDeDocumentos } from './catalogos/catalogo-de-documentos.service';
import { TIPOS_DOCUMENTO } from '../fase/fase.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  ID_AVALIACAO,
  PROCESSO_ID,
  ROTA_FASES,
  ROTA_PROCESSO,
  ROTA_DOCUMENTOS,
  PROCESSO_COM_ETAPA_GRAVADA,
  PROBLEM_JSON,
} from './cronograma.testing';

const CAMPO = 'documento.requisitos.formatosPermitidos';
const MENSAGEM = 'Formato recusado pelo servidor';
const TIPOS = [
  TIPOS_DOCUMENTO[0],
  { ...TIPOS_DOCUMENTO[0], id: 'outro-documento', nome: 'Outro documento' },
];

describe('Recusas dos documentos exigidos no cronograma', () => {
  let tela: ContextoDoCronograma;
  usarCronograma((contexto) => {
    tela = contexto;
  });

  function preparar() {
    tela.comFases(ID_AVALIACAO);
    TestBed.inject(CatalogoDeDocumentos).tiposDocumento.set(TIPOS);
    const fase = tela.store.draft().cronograma.fases[0].codigo;
    const regras = TIPOS.map((tipo) =>
      regraDoRascunho({
        forma: 'DOCUMENTO',
        documento: exigencia({ faseCodigo: fase, tipoDocumentoId: tipo.id }),
      }),
    );
    tela.store.patchSection('documentos', { emTodasAsFases: [], regrasDeComprovacao: regras });
    tela.store.processoSeletivoId.set(PROCESSO_ID);
    tela.detectar();
    return regras;
  }

  async function gravar(campo?: string) {
    vi.spyOn(tela.conferencia, 'validar').mockReturnValue({ valid: true });
    const resultado = tela.componente.persistir();
    tela.controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
    await tela.proximoPasso();
    await tela.gravouEtapas();
    tela.controller.expectOne(ROTA_PROCESSO).flush({
      ...PROCESSO_COM_ETAPA_GRAVADA,
      cronogramaFases: [{ id: ID_AVALIACAO, codigo: 'AVALIACAO', faseCanonica: {} }],
    });
    await tela.proximoPasso();
    recusarDocumentos(campo);
    const resposta = await resultado;
    tela.detectar();
    return resposta;
  }

  function recusarDocumentos(campo?: string): void {
    tela.controller.expectOne(ROTA_DOCUMENTOS).flush(
      {
        title: 'Recusa geral',
        status: 422,
        code: 'uniplus.validacao',
        errors: [{ field: campo, code: 'formato', message: MENSAGEM }],
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );
  }

  it('abre a segunda exigência, mostra a recusa no formato e limpa ao editar', async () => {
    const regras = preparar();
    const id = regras[1].identificadorNoRascunho;
    await gravar(`regrasDeComprovacao[1].${CAMPO}`);
    const campo = tela.nativo.querySelector<HTMLInputElement>(`[id$="doc-arquivo-${id}-qualquer"]`);
    const primeiro = tela.nativo.querySelector(
      `[id$="doc-arquivo-${regras[0].identificadorNoRascunho}-formatos-recusas"]`,
    );
    expect(primeiro?.textContent ?? '').not.toContain(MENSAGEM);
    expect(campo?.closest('fieldset')?.textContent).toContain(MENSAGEM);
    campo?.dispatchEvent(new Event('change'));
    tela.detectar();
    expect(campo?.closest('fieldset')?.textContent).not.toContain(MENSAGEM);
  });

  it('leva o foco ao primeiro campo recusado', async () => {
    const regras = preparar();
    document.body.append(tela.nativo);
    await gravar(`regrasDeComprovacao[1].${CAMPO}`);
    const id = regras[1].identificadorNoRascunho;
    const campo = tela.nativo.querySelector(`[id$="doc-arquivo-${id}-qualquer"]`);
    expect(document.activeElement).toBe(campo);
    tela.nativo.remove();
  });

  it('mantém a recusa sem identificação apenas na mensagem geral', async () => {
    preparar();
    const resultado = await gravar();
    expect(resultado.messages?.join(' ')).toContain('Recusa geral');
    expect(tela.nativo.textContent).not.toContain(MENSAGEM);
  });
});
