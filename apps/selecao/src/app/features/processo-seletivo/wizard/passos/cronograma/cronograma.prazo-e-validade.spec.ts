import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { exigencia, regraDoRascunho } from '../../shared/exigencias/exigencias.testing';
import { TIPOS_DOCUMENTO } from '../fase/fase.testing';
import { CatalogoDeDocumentos } from './catalogos/catalogo-de-documentos.service';
import { CatalogoDasEscolhasDoPrazoDeEmissao } from './catalogos/catalogo-das-escolhas-do-prazo-de-emissao.service';
import { CatalogoDasEscolhasDaValidade } from './catalogos/catalogo-das-escolhas-da-validade.service';
import { CatalogoDasUnidadesDoPrazoDeEmissao } from './catalogos/catalogo-das-unidades-do-prazo-de-emissao.service';
import { CatalogoDosTiposDaDataDeReferencia } from './catalogos/catalogo-dos-tipos-da-data-de-referencia.service';
import { CatalogoDosEfeitosNaAnaliseDoDocumento } from './catalogos/catalogo-dos-efeitos-na-analise-do-documento.service';
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

const opcao = (codigo: string) => ({ codigo, rotulo: codigo });

function preencherCatalogos(): void {
  TestBed.inject(CatalogoDasEscolhasDoPrazoDeEmissao).escolhasDoPrazoDeEmissao.set([
    opcao('comPrazo'),
  ]);
  TestBed.inject(CatalogoDasEscolhasDaValidade).escolhasDaValidade.set([
    opcao('exigeDocumentoValido'),
  ]);
  TestBed.inject(CatalogoDasUnidadesDoPrazoDeEmissao).unidadesDoPrazoDeEmissao.set([opcao('dias')]);
  TestBed.inject(CatalogoDosTiposDaDataDeReferencia).tiposDaDataDeReferencia.set([
    opcao('fimDasInscricoes'),
  ]);
  TestBed.inject(CatalogoDosEfeitosNaAnaliseDoDocumento).efeitosNaAnaliseDoDocumento.set([
    opcao('recusarDocumento'),
  ]);
}

function mudar(elemento: HTMLElement, sufixo: string, valor?: string): void {
  const campo = elemento.querySelector<HTMLInputElement | HTMLSelectElement>(`[id$="${sufixo}"]`);
  if (!campo) throw new Error(`Campo não encontrado: ${sufixo}`);
  if (valor !== undefined) campo.value = valor;
  campo.dispatchEvent(
    new Event(campo instanceof HTMLInputElement && campo.type === 'number' ? 'input' : 'change'),
  );
}

function declararDocumento(tela: ContextoDoCronograma): string {
  const faseCodigo = tela.store.draft().cronograma.fases[0].codigo;
  const documento = exigencia({ faseCodigo, tipoDocumentoId: TIPOS_DOCUMENTO[0].id });
  const regra = regraDoRascunho({ forma: 'DOCUMENTO', documento });
  tela.store.patchSection('documentos', { emTodasAsFases: [], regrasDeComprovacao: [regra] });
  return regra.identificadorNoRascunho;
}

function abrirDocumento(tela: ContextoDoCronograma): string {
  tela.comFases(ID_AVALIACAO);
  TestBed.inject(CatalogoDeDocumentos).tiposDocumento.set(TIPOS_DOCUMENTO);
  const identificador = declararDocumento(tela);
  tela.store.processoSeletivoId.set(PROCESSO_ID);
  tela.expansao.abrirFases([0]);
  tela.detectar();
  tela.nativo.querySelector<HTMLButtonElement>('.doc-conferencia__alternar')?.click();
  tela.detectar();
  preencherCatalogos();
  tela.detectar();
  return identificador;
}

function configurarPrazo(tela: ContextoDoCronograma, id: string): void {
  mudar(tela.nativo, `prazo-${id}-comPrazo`);
  tela.detectar();
  TestBed.inject(CatalogoDosTiposDaDataDeReferencia).tiposDaDataDeReferencia.set([
    opcao('fimDasInscricoes'),
  ]);
  tela.detectar();
  mudar(tela.nativo, `-prazo-${id}-valor`, '30');
  mudar(tela.nativo, `-prazo-${id}-unidade`, 'dias');
  mudar(tela.nativo, `-prazo-${id}-referencia-tipo`, 'fimDasInscricoes');
  mudar(tela.nativo, `-prazo-${id}-efeito`, 'recusarDocumento');
}

function configurarValidade(tela: ContextoDoCronograma, id: string): void {
  mudar(tela.nativo, `validade-${id}-exigeDocumentoValido`);
  tela.detectar();
  mudar(tela.nativo, `-validade-${id}-referencia-tipo`, 'fimDasInscricoes');
  mudar(tela.nativo, `-validade-${id}-efeito`, 'recusarDocumento');
}

async function avancarGravacao(tela: ContextoDoCronograma): Promise<void> {
  tela.controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
  await tela.proximoPasso();
  await tela.gravouEtapas();
  tela.controller.expectOne(ROTA_PROCESSO).flush({
    ...PROCESSO_COM_ETAPA_GRAVADA,
    cronogramaFases: [{ id: ID_AVALIACAO, codigo: 'AVALIACAO', faseCanonica: {} }],
  });
  await tela.proximoPasso();
}

const REQUISITOS_CONFIGURADOS = {
  prazoDeEmissao: {
    escolha: 'comPrazo',
    valor: 30,
    unidade: 'dias',
    referencia: { tipo: 'fimDasInscricoes' },
    efeitoForaDoPrazo: 'recusarDocumento',
  },
  validade: {
    escolha: 'exigeDocumentoValido',
    referencia: { tipo: 'fimDasInscricoes' },
    efeitoDoVencimento: 'recusarDocumento',
  },
};

describe('edição do prazo e da validade no cronograma', () => {
  let tela: ContextoDoCronograma;
  usarCronograma((contexto) => {
    tela = contexto;
  });

  it('grava o prazo e a validade configurados na exigência', async () => {
    const id = abrirDocumento(tela);
    configurarPrazo(tela, id);
    configurarValidade(tela, id);
    vi.spyOn(tela.conferencia, 'validar').mockReturnValue({ valid: true });
    const gravacao = tela.componente.persistir();
    await avancarGravacao(tela);
    const requisicao = tela.controller.expectOne(ROTA_DOCUMENTOS);
    expect(requisicao.request.body[0].documento.requisitos).toMatchObject(REQUISITOS_CONFIGURADOS);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await gravacao;
  });

  it.each([
    ['prazoDeEmissao', 'prazo'],
    ['validade', 'validade'],
  ])('mostra a recusa da referência de %s e limpa ao editar', async (requisito, identificador) => {
    const id = abrirDocumento(tela);
    configurarPrazo(tela, id);
    configurarValidade(tela, id);
    vi.spyOn(tela.conferencia, 'validar').mockReturnValue({ valid: true });
    document.body.append(tela.nativo);
    const gravacao = tela.componente.persistir();
    await avancarGravacao(tela);
    tela.controller.expectOne(ROTA_DOCUMENTOS).flush(
      {
        title: 'Recusa geral',
        status: 422,
        code: 'uniplus.validacao',
        errors: [
          {
            field: `regrasDeComprovacao[0].documento.requisitos.${requisito}.referencia`,
            code: 'data_de_referencia_do_documento.ausente',
            message: 'Informe a data de referência.',
          },
        ],
      },
      { status: 422, statusText: 'Unprocessable Content', headers: PROBLEM_JSON },
    );
    await gravacao;
    tela.detectar();
    const seletor = tela.nativo.querySelector<HTMLSelectElement>(
      `[id$="-${identificador}-${id}-referencia-tipo"]`,
    );
    expect(seletor?.parentElement?.textContent).toContain('Informe a data de referência.');
    expect(seletor?.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(seletor);
    seletor?.dispatchEvent(new Event('change'));
    tela.detectar();
    expect(seletor?.parentElement?.textContent).not.toContain('Informe a data de referência.');
    expect(seletor?.getAttribute('aria-invalid')).toBeNull();
    tela.nativo.remove();
  });
});
