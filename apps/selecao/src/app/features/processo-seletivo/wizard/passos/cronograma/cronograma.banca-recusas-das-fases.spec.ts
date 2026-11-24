import { CRITERIOS, RESULTADOS } from '../../shared/deliberacao/regra-de-deliberacao.testing';
import { By } from '@angular/platform-browser';
import type { TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it, vi } from 'vitest';

import type { BancaRequeridaDaFase } from '../../modelos/banca.models';
import { umaBancaRequeridaDaFase } from '../../shared/bancas/banca-declarada.testing';
import { NOTA_DA_BANCA_AUSENTE } from '../../shared/bancas/recusas-das-bancas';
import { COLEGIADA, comRegra } from '../../shared/deliberacao/regra-de-deliberacao.testing';
import { CatalogoDeBancas } from './catalogos/catalogo-de-bancas.service';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import { AjudantesDeRecusasDasFases } from './cronograma-recusas-das-fases.testing';
import { FaseEmEdicao } from '../fase/fase-em-edicao';
import { BancasDaFaseComponent } from '../fase/secoes/bancas-da-fase.component';
import { ID_AVALIACAO, ID_BANCA_HETERO } from './cronograma.testing';

const BANCAS = [
  { id: ID_BANCA_HETERO, nome: 'Heteroidentificação', codigo: { rotulo: 'Heteroidentificação' } },
] as TipoBancaDto[];

const QUORUM = 'uniplus.selecao.banca.quorum_fora_do_intervalo';
const SECAO = 'fase-AVALIACAO-bancas-erro';

const banca = (identificadorLocal: string): BancaRequeridaDaFase =>
  umaBancaRequeridaDaFase({
    identificadorLocal,
    tipoBancaId: ID_BANCA_HETERO,
    regraDeDeliberacao: COLEGIADA,
  });

describe('CronogramaPassoComponent: recusas do servidor às bancas da fase', () => {
  let tela: ContextoDoCronograma;
  let ajudantes: AjudantesDeRecusasDasFases;

  usarCronograma((montada) => {
    tela = montada;
    ajudantes = new AjudantesDeRecusasDasFases(montada);
  });

  function comBancas(...chaves: string[]): void {
    tela.elementoDaTela.injector.get(CatalogoDeBancas).bancas.set(BANCAS);
    tela.comFases(ID_AVALIACAO);
    tela.comUmaEtapa();
    noRascunho(...chaves);
  }
  function noRascunho(...chaves: string[]): void {
    const [fase] = tela.store.draft().cronograma.fases;
    const bancasRequeridas = chaves.map(banca);
    tela.store.patchObjectSection('cronograma', { fases: [{ ...fase, bancasRequeridas }] });
    tela.detectar();
  }
  const recusar = (field: string, code = QUORUM) =>
    ajudantes.recusarFases([{ field, code, message: `Detalhe de ${field}.` }]);
  const daBanca = (numero: number) =>
    ajudantes.bloco(`fase-AVALIACAO-bancas-banca-${numero}-recusas`);
  const grupo = (numero: number) =>
    tela.nativo.querySelector(`#fase-AVALIACAO-bancas-banca-${numero}`);
  const controle = (numero: number, sufixo: string) =>
    tela.nativo.querySelector(`#fase-AVALIACAO-regra-banca-${numero}-${sufixo}`);
  const doControle = (numero: number, sufixo: string) =>
    ajudantes.bloco(`fase-AVALIACAO-regra-banca-${numero}-${sufixo}-recusas`);
  const categorias = (numero: number) =>
    tela.nativo.querySelector(`#fase-AVALIACAO-bancas-banca-${numero}-categorias`);
  const vezes = (texto: string) => (tela.nativo.textContent ?? '').split(texto).length - 1;

  it('põe duas recusas de posições diferentes cada uma no controle da banca do mesmo tipo', async () => {
    comBancas('banca-1', 'banca-2');

    await ajudantes.recusarFases([
      {
        field: 'fases[0].bancasRequeridas[1].regraDeDeliberacao.quorum',
        code: QUORUM,
        message: 'Do quórum.',
      },
      {
        field: 'fases[0].bancasRequeridas[0].regraDeDeliberacao.criterio',
        code: QUORUM,
        message: 'Do critério.',
      },
    ]);

    expect(doControle(1, 'criterio')).toContain('Do critério.');
    expect(doControle(1, 'quorum')).toBeNull();
    expect(doControle(2, 'quorum')).toContain('Do quórum.');
    expect(doControle(2, 'criterio')).toBeNull();
    expect(ajudantes.bloco(SECAO)).toBeNull();
  });

  it('mostra a recusa junto do controle, com mensagem e código, uma só vez', async () => {
    comBancas('banca-1', 'banca-2');

    await recusar('fases[0].bancasRequeridas[1].regraDeDeliberacao.quorum');

    expect(doControle(2, 'quorum')).toContain(QUORUM);
    expect(vezes('Detalhe de fases[0].bancasRequeridas[1].regraDeDeliberacao.quorum.')).toBe(1);
    expect(vezes(QUORUM)).toBe(1);
    expect(daBanca(2)).toBeNull();
  });

  it('liga o controle recusado à recusa dele, e o grupo só à recusa da banca inteira', async () => {
    comBancas('banca-1', 'banca-2');

    await recusar('fases[0].bancasRequeridas[1].regraDeDeliberacao.quorum');

    expect(controle(2, 'quorum')?.getAttribute('aria-describedby')).toBe(
      'fase-AVALIACAO-regra-banca-2-quorum-recusas',
    );
    expect(controle(2, 'quorum')?.getAttribute('aria-invalid')).toBe('true');
    expect(controle(1, 'quorum')?.getAttribute('aria-invalid')).toBeNull();
    expect(grupo(2)?.getAttribute('aria-describedby')).toBeNull();

    await recusar('fases[0].bancasRequeridas[0]');

    expect(grupo(1)?.getAttribute('aria-describedby')).toBe(
      'fase-AVALIACAO-bancas-banca-1-recusas',
    );
    expect(grupo(1)?.getAttribute('aria-invalid')).toBeNull();
  });

  it('mostra sob o modo, e leva o foco a ele, a recusa do controle que a regra atual não mostra', async () => {
    comBancas('banca-1');
    const [fase] = tela.store.draft().cronograma.fases;
    const regra = comRegra({ criterio: CRITERIOS.unanimidade, desempate: null, semUnanimidade: RESULTADOS.favoravel });
    tela.store.patchObjectSection('cronograma', {
      fases: [
        {
          ...fase,
          bancasRequeridas: fase.bancasRequeridas.map((b) => ({ ...b, regraDeDeliberacao: regra })),
        },
      ],
    });
    tela.detectar();

    await recusar('fases[0].bancasRequeridas[0].regraDeDeliberacao.desempate');

    expect(controle(1, 'desempate')).toBeNull();
    expect(doControle(1, 'modo')).toContain('Detalhe de fases[0].bancasRequeridas[0]');
    await tela.proximoPasso();
    expect(document.activeElement).toBe(controle(1, 'modo'));
  });

  it('mostra a recusa das categorias no conjunto delas, sem marcar as caixas, e leva o foco a ele', async () => {
    comBancas('banca-1', 'banca-2');

    await recusar('fases[0].bancasRequeridas[1].categoriasDocumentoIds');

    const bloco = ajudantes.bloco('fase-AVALIACAO-bancas-banca-2-categorias-recusas');
    expect(bloco).toContain('Detalhe de fases[0].bancasRequeridas[1].categoriasDocumentoIds.');
    expect(vezes('Detalhe de fases[0].bancasRequeridas[1].categoriasDocumentoIds.')).toBe(1);
    expect(categorias(2)?.getAttribute('aria-describedby')).toBe(
      'fase-AVALIACAO-bancas-banca-2-categorias-recusas',
    );
    expect(categorias(1)?.getAttribute('aria-describedby')).toBeNull();
    expect(daBanca(2)).toBeNull();
    expect(categorias(2)?.querySelector('[aria-invalid]')).toBeNull();
    await tela.proximoPasso();
    expect(document.activeElement).toBe(categorias(2));
  });

  it('leva o foco ao controle da banca recusada e, sem controle, ao grupo dela', async () => {
    comBancas('banca-1', 'banca-2');

    await recusar('fases[0].bancasRequeridas[1].regraDeDeliberacao.quorum');
    await tela.proximoPasso();
    expect(document.activeElement).toBe(controle(2, 'quorum'));

    await recusar('fases[0].bancasRequeridas[0]');
    await tela.proximoPasso();
    expect(document.activeElement).toBe(grupo(1));
  });

  it('deixa na seção, sem nota, a recusa que não aponta banca', async () => {
    comBancas('banca-1');

    await recusar('fases[0].bancasRequeridas', 'uniplus.selecao.cronograma.recurso_sem_banca');

    expect(ajudantes.bloco(SECAO)).toContain('Detalhe de fases[0].bancasRequeridas.');
    expect(ajudantes.bloco(SECAO)).not.toContain(NOTA_DA_BANCA_AUSENTE);
    expect(daBanca(1)).toBeNull();
  });

  it('leva à seção, com a nota, a recusa de banca retirada depois do envio', async () => {
    comBancas('banca-1', 'banca-2');
    await recusar('fases[0].bancasRequeridas[1].regraDeDeliberacao.quorum');

    noRascunho('banca-1');

    expect(ajudantes.bloco(SECAO)).toContain('Detalhe de fases[0].bancasRequeridas[1]');
    expect(ajudantes.bloco(SECAO)).toContain(NOTA_DA_BANCA_AUSENTE);
    expect(daBanca(1)).toBeNull();
  });

  it('leva à seção, com a nota, a recusa de uma posição que o envio não tinha', async () => {
    comBancas('banca-1');

    await recusar('fases[0].bancasRequeridas[4]');

    expect(ajudantes.bloco(SECAO)).toContain(NOTA_DA_BANCA_AUSENTE);
  });
  it('calcula as recusas das bancas uma vez por mudança, e não a cada leitura da tela', async () => {
    comBancas('banca-1', 'banca-2');
    await recusar('fases[0].bancasRequeridas[1].regraDeDeliberacao.quorum');
    const secao = tela.elementoDaTela.query(By.directive(BancasDaFaseComponent));
    const calculo = vi.spyOn(secao.injector.get(FaseEmEdicao), 'recusasDasBancas');

    noRascunho('banca-1', 'banca-2', 'banca-3');
    noRascunho('banca-1', 'banca-2');

    expect(calculo.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
