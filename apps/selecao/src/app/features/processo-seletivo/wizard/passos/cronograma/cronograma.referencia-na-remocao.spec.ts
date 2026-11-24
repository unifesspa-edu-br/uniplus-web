import { expect, it } from 'vitest';
import { exigencia, rascunho, ID_RG } from '../../shared/exigencias/exigencias.testing';
import { CatalogoDeDocumentos } from './catalogos/catalogo-de-documentos.service';
import { ID_INSCRICAO, ID_AVALIACAO } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import { TIPOS_DOCUMENTO } from '../fase/fase.testing';
import { TestBed } from '@angular/core/testing';

const prazo = {
  escolha: 'COM_PRAZO',
  valor: 90,
  unidade: 'DIAS',
  referencia: { tipo: 'INICIO_DA_FASE', data: null, faseCodigo: 'AVALIACAO' },
  efeitoForaDoPrazo: 'RECUSAR_DOCUMENTO',
};

describe('remoção de fase referenciada por documento', () => {
  let tela: ContextoDoCronograma;
  usarCronograma((contexto) => {
    tela = contexto;
  });

  function declararDocumento(faseCodigo: string, referenciaFaseCodigo = 'AVALIACAO'): void {
    tela.store.patchSection(
      'documentos',
      rascunho(
        exigencia({
          faseCodigo,
          prazoDeEmissao: {
            ...prazo,
            referencia: { ...prazo.referencia, faseCodigo: referenciaFaseCodigo },
          },
        }),
      ),
    );
    TestBed.inject(CatalogoDeDocumentos).tiposDocumento.set([
      { ...TIPOS_DOCUMENTO[0], id: ID_RG, nome: 'RG' },
    ]);
    tela.detectar();
  }

  it('lista o documento de outra fase e impede confirmar', () => {
    tela.comFases(ID_INSCRICAO, ID_AVALIACAO);
    declararDocumento('COLETA_INSCRICAO');
    tela.expansao.pedirRemocaoDaFase(1);
    tela.detectar();
    const botao = tela.nativo.querySelector<HTMLButtonElement>('.btn--danger');
    expect(tela.nativo.textContent).toContain('RG');
    expect(tela.nativo.textContent).toContain('Inscrição');
    expect(botao?.disabled).toBe(true);
    expect(
      document.getElementById(botao?.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toContain(
      'Troque a referência do prazo ou da validade destes documentos antes de remover a fase.',
    );
    tela.expansao.confirmarRemocaoDaFase(1);
    expect(tela.store.draft().cronograma.fases).toHaveLength(2);
  });

  it('permite remover após trocar a referência', () => {
    tela.comFases(ID_INSCRICAO, ID_AVALIACAO);
    declararDocumento('COLETA_INSCRICAO');
    tela.expansao.pedirRemocaoDaFase(1);
    declararDocumento('COLETA_INSCRICAO', 'COLETA_INSCRICAO');
    tela.detectar();
    expect(tela.nativo.querySelector<HTMLButtonElement>('.btn--danger')?.disabled).toBe(false);
    tela.expansao.confirmarRemocaoDaFase(1);
    expect(tela.store.draft().cronograma.fases).toHaveLength(1);
  });

  it('não bloqueia referência de documento da própria fase', () => {
    tela.comFases(ID_INSCRICAO, ID_AVALIACAO);
    declararDocumento('AVALIACAO');
    tela.expansao.pedirRemocaoDaFase(1);
    expect(tela.cronograma.dependentesDaFase(1).referencias).toHaveLength(0);
    tela.expansao.confirmarRemocaoDaFase(1);
    expect(tela.store.draft().documentos.regrasDeComprovacao).toHaveLength(0);
  });
});
