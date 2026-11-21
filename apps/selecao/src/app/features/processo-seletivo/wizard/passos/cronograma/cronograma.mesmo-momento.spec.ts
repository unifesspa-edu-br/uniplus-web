import axe from 'axe-core';
import { StatusProcesso, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { ID_AVALIACAO, ID_INSCRICAO, ID_RESULTADO, ROTA_FASES } from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import { AjudantesDeRecusasDasFases } from './cronograma-recusas-das-fases.testing';

const RECUSA = {
  field: 'fases[0].noMesmoMomentoDaAnterior',
  code: 'uniplus.selecao.processo_seletivo.primeira_fase_no_mesmo_momento_da_anterior',
  message: 'A primeira fase não pode ter esta marca.',
};

describe('Cronograma: marca do mesmo momento', () => {
  let tela: ContextoDoCronograma;
  let recusas: AjudantesDeRecusasDasFases;
  usarCronograma((contexto) => {
    tela = contexto;
    recusas = new AjudantesDeRecusasDasFases(contexto);
  });

  const caixa = (indice: number) =>
    tela.nativo.querySelector<HTMLInputElement>(`#cr-mesmo-momento-${indice}`);
  const abrir = (...indices: number[]) => {
    tela.expansao.abrirFases(indices);
    tela.detectar();
  };

  it('oferece a marca desligada somente a partir da segunda fase e associa a ajuda', () => {
    tela.comFases(ID_INSCRICAO, ID_AVALIACAO);
    abrir(0, 1);
    expect(caixa(0)).toBeNull();
    expect(caixa(1)?.checked).toBe(false);
    expect(caixa(1)?.getAttribute('aria-describedby')).toBe('cr-mesmo-momento-ajuda-1');
  });

  it('mostra a primeira fase ligada vinda da leitura e mantém a caixa ao desmarcar', () => {
    tela.comFaseAjustada(ID_INSCRICAO, { noMesmoMomentoDaAnterior: true });
    abrir(0);
    expect(caixa(0)?.checked).toBe(true);
    caixa(0)?.click();
    tela.detectar();
    expect(caixa(0)?.checked).toBe(false);
  });

  it('mostra a recusa junto da primeira fase e associa a mensagem à caixa', async () => {
    tela.comFases(ID_INSCRICAO);
    await recusas.recusarFases([RECUSA]);
    expect(caixa(0)?.getAttribute('aria-invalid')).toBe('true');
    expect(caixa(0)?.getAttribute('aria-describedby')).toContain('cr-mesmo-momento-erro-0');
    expect(tela.nativo.querySelector('#cr-mesmo-momento-erro-0')?.textContent).toContain(
      RECUSA.message,
    );
    expect(
      (await axe.run(tela.nativo, { rules: { region: { enabled: false } } })).violations,
    ).toEqual([]);
  });

  it('envia a marca ligada na gravação', async () => {
    tela.comFases(ID_INSCRICAO, ID_RESULTADO);
    abrir(1);
    caixa(1)?.click();
    tela.detectar();
    tela.store.processoSeletivoId.set('01960000-0000-7000-0000-0000000007aa');
    const fasesSalvas = tela.store.draft().cronograma.fases;
    const gravacao = tela.componente.persistir();
    const requisicao = tela.controller.expectOne(ROTA_FASES);
    expect(requisicao.request.body).toMatchObject([{}, { noMesmoMomentoDaAnterior: true }]);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await tela.proximoPasso();
    await tela.gravouEtapas();
    await tela.gravouExigencias();
    await gravacao;
    tela.store.patchObjectSection('cronograma', { fases: [] });
    tela.detectar();
    tela.store.patchObjectSection('cronograma', { fases: fasesSalvas });
    abrir(1);
    expect(caixa(1)?.checked).toBe(true);
  });

  it('desmarca ao subir para primeiro e anuncia a fase', () => {
    tela.comFases(ID_INSCRICAO, ID_RESULTADO);
    abrir(0, 1);
    caixa(1)?.click();
    tela.detectar();
    tela.cronograma.sequencia.mover(1, -1);
    tela.detectar();
    expect(caixa(0)?.checked).toBe(false);
    expect(tela.nativo.querySelector('[role="status"].field__hint')?.textContent).toContain(
      'passou a ser a primeira do cronograma e deixou de estar marcada',
    );
  });

  it('mantém a marca e não avisa ao mover entre as outras fases', () => {
    tela.comFases(ID_INSCRICAO, ID_AVALIACAO, ID_RESULTADO);
    abrir(1, 2);
    caixa(1)?.click();
    tela.detectar();
    tela.cronograma.sequencia.mover(1, 1);
    tela.detectar();
    expect(tela.cronograma.fases.at(2).controls.noMesmoMomentoDaAnterior.value).toBe(true);
    expect(tela.nativo.querySelector('[role="status"].field__hint')?.textContent?.trim()).toBe('');
  });
  it('foca a caixa ao recusar a gravação', async () => {
    tela.comFases(ID_INSCRICAO);
    await recusas.recusarFases([RECUSA]);
    await tela.proximoPasso();
    tela.detectar();
    expect(document.activeElement?.id).toBe('cr-mesmo-momento-0');
  });

  it('mantém a recusa de precedência ao corrigir outra fase', async () => {
    tela.comFases(ID_INSCRICAO, ID_RESULTADO);
    await recusas.recusarFases([
      {
        field: 'fases[1].noMesmoMomentoDaAnterior',
        code: 'uniplus.selecao.processo_seletivo.fases_com_precedencia_no_mesmo_momento',
        message: 'Fases ligadas por precedência não podem estar no mesmo momento.',
      },
    ]);
    tela.cronograma.fases.at(0).controls.noMesmoMomentoDaAnterior.setValue(true);
    tela.detectar();
    expect(tela.nativo.querySelector('#cr-mesmo-momento-erro-1')?.textContent).toContain(
      'Fases ligadas por precedência',
    );
  });

  it('mostra a marca publicada na consulta', () => {
    tela.comFaseAjustada(ID_INSCRICAO, { noMesmoMomentoDaAnterior: true });
    tela.store.remoteSnapshot.set({
      status: StatusProcesso.publicado,
    } as unknown as ProcessoSeletivoDto);
    tela.detectar();
    const texto = tela.nativo.querySelector('sel-fase-em-consulta')?.textContent ?? '';
    expect(texto).toContain('No mesmo momento da anterior');
    expect(texto).toContain('Sim');
  });
});
