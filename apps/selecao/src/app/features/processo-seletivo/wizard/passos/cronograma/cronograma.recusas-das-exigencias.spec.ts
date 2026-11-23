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

const PROCESSO_COM_AVALIACAO = {
  ...PROCESSO_COM_ETAPA_GRAVADA,
  cronogramaFases: [{ id: ID_AVALIACAO, codigo: 'AVALIACAO', faseCanonica: {} }],
};

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
    tela.controller.expectOne(ROTA_PROCESSO).flush(PROCESSO_COM_AVALIACAO);
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

  it('mostra na fase acrescentada a recusa da exigência herdada', async () => {
    const [modelo] = preparar();
    const documento = exigencia({ faseCodigo: 'ISENCAO', tipoDocumentoId: TIPOS[0].id });
    tela.store.patchSection('documentos', {
      emTodasAsFases: [TIPOS[0].id],
      regrasDeComprovacao: [{ ...modelo, documento }],
    });
    tela.detectar();
    await gravar(`regrasDeComprovacao[0].${CAMPO}`);
    const campo = tela.nativo.querySelector(`[id$="doc-arquivo-${TIPOS[0].id}-qualquer"]`);
    expect(campo?.closest('fieldset')?.textContent).toContain(MENSAGEM);
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

  async function recusarCampoDoGrupo(campo: string): Promise<string> {
    const grupo = regraDoRascunho({
      forma: 'QUANTIDADE_MINIMA_DE_ITENS',
      quantidadeMinima: 1,
      itens: preparar(),
    });
    tela.store.patchSection('documentos', { emTodasAsFases: [], regrasDeComprovacao: [grupo] });
    tela.detectar();
    await gravar(`regrasDeComprovacao[0].${campo}`);
    tela.controller
      .match((pedido) => pedido.url.includes('/vocabularios/'))
      .forEach((pedido) => pedido.flush([]));
    return grupo.identificadorNoRascunho;
  }

  it('abre a combinação e mostra a recusa da quantidade mínima', async () => {
    const identificador = await recusarCampoDoGrupo('cardinalidade.quantidadeMinima');
    const campo = tela.nativo.querySelector<HTMLInputElement>(`#quantidade-${identificador}`);
    expect(campo?.getAttribute('aria-invalid')).toBe('true');
    expect(campo?.parentElement?.textContent).toContain(MENSAGEM);
    if (campo) {
      campo.value = '2';
      campo.dispatchEvent(new Event('input'));
    }
    tela.detectar();
    expect(campo?.parentElement?.textContent).not.toContain(MENSAGEM);
  });

  it.each(['consequencia', 'basesLegais'])('mostra a recusa do grupo em %s', async (campo) => {
    const identificador = await recusarCampoDoGrupo(`indeferimento.${campo}`);
    const prefixo = campo === 'consequencia' ? 'consequencia' : 'normas';
    const recusa = tela.nativo.querySelector(`#${prefixo}-${identificador}-recusas`);
    expect(recusa?.textContent).toContain(MENSAGEM);
  });

  it('mantém a recusa sem identificação apenas na mensagem geral', async () => {
    preparar();
    const resultado = await gravar();
    expect(resultado.messages?.join(' ')).toContain('Recusa geral');
    expect(resultado.messages?.join(' ')).toContain(MENSAGEM);
  });
});
