import { CRITERIOS, RESULTADOS } from '../../shared/deliberacao/regra-de-deliberacao.testing';
import type { FormGroup } from '@angular/forms';
import type { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';
import type { TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it, vi } from 'vitest';

import { NOTA_DA_BANCA_AUSENTE } from '../../shared/bancas/recusas-das-bancas';
import { COLEGIADA, comRegra } from '../../shared/deliberacao/regra-de-deliberacao.testing';
import { RECUSA_MOSTRADA_NOS_CAMPOS } from '../../shared/recusas/texto-da-recusa-no-resumo';
import {
  acrescentarBancaNaEtapa,
  declararRegraNaBanca,
  retirarBancaDaEtapa,
} from './bancas-da-etapa.testing';
import { CatalogoDeBancas } from './catalogos/catalogo-de-bancas.service';
import type { EtapaForm } from './cronograma-form';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import { AjudantesDeRecusasDasEtapas } from './cronograma-recusas-das-etapas.testing';
import { RecusasDoServidorNasEtapas } from './servicos/recusas-do-servidor-nas-etapas.service';
import { ID_AVALIACAO, ID_BANCA_HETERO, ROTA_ETAPAS } from './cronograma.testing';

const BANCAS = [
  { id: ID_BANCA_HETERO, nome: 'Heteroidentificação', codigo: { rotulo: 'Heteroidentificação' } },
] as TipoBancaDto[];

const QUORUM = 'uniplus.selecao.banca.quorum_fora_do_intervalo';
const CRITERIO = 'uniplus.selecao.banca.criterio_obrigatorio';
const SECAO = 'cr-etapa-bancas-erro-0';

describe('CronogramaPassoComponent: recusas do servidor às bancas da etapa', () => {
  let tela: ContextoDoCronograma;
  let ajudantes: AjudantesDeRecusasDasEtapas;

  usarCronograma((montada) => {
    tela = montada;
    ajudantes = new AjudantesDeRecusasDasEtapas(montada);
  });

  function comDuasBancasDoMesmoTipo(): FormGroup<EtapaForm> {
    tela.elementoDaTela.injector.get(CatalogoDeBancas).bancas.set(BANCAS);
    tela.comFases(ID_AVALIACAO);
    tela.comEtapasEmFases(['AVALIACAO']);
    tela.expansao.alternarFase(0);
    tela.expansao.alternarEtapa(0);
    const etapa = tela.cronograma.etapas.at(0);
    for (const chave of ['banca-1', 'banca-2']) {
      acrescentarBancaNaEtapa(tela.edicao, etapa, ID_BANCA_HETERO);
      declararRegraNaBanca(tela.edicao, etapa, chave, COLEGIADA);
    }
    tela.detectar();
    return etapa;
  }
  const recusar = (field: string, code = QUORUM) =>
    ajudantes.recusarEtapas([{ field, code, message: `Detalhe de ${field}.` }]);
  const daBanca = (numero: number) => ajudantes.bloco(`cr-etapa-bancas-0-banca-${numero}-recusas`);
  const grupo = (numero: number) => tela.nativo.querySelector(`#cr-etapa-bancas-0-banca-${numero}`);
  const controle = (numero: number, sufixo: string) =>
    tela.nativo.querySelector(`#etapa-0-banca-banca-${numero}-${sufixo}`);
  const doControle = (numero: number, sufixo: string) =>
    ajudantes.bloco(`etapa-0-banca-banca-${numero}-${sufixo}-recusas`);
  const vezes = (texto: string) => (tela.nativo.textContent ?? '').split(texto).length - 1;

  it('mostra junto do controle recusado, com mensagem e código, uma só vez', async () => {
    comDuasBancasDoMesmoTipo();

    await recusar('etapas[0].bancas[1].regraDeDeliberacao.quorum');

    expect(doControle(2, 'quorum')).toContain(
      'Detalhe de etapas[0].bancas[1].regraDeDeliberacao.quorum.',
    );
    expect(doControle(2, 'quorum')).toContain(QUORUM);
    expect(vezes('Detalhe de etapas[0].bancas[1].regraDeDeliberacao.quorum.')).toBe(1);
    expect(vezes(QUORUM)).toBe(1);
    expect(daBanca(2)).toBeNull();
    expect(doControle(1, 'quorum')).toBeNull();
    expect(ajudantes.bloco(SECAO)).toBeNull();
  });

  it('põe duas recusas de posições diferentes cada uma no controle da banca que estava na posição', async () => {
    comDuasBancasDoMesmoTipo();

    await ajudantes.recusarEtapas([
      {
        field: 'etapas[0].bancas[1].regraDeDeliberacao.quorum',
        code: QUORUM,
        message: 'Do quórum.',
      },
      {
        field: 'etapas[0].bancas[0].regraDeDeliberacao.criterio',
        code: CRITERIO,
        message: 'Do critério.',
      },
    ]);

    expect(doControle(1, 'criterio')).toContain('Do critério.');
    expect(doControle(1, 'quorum')).toBeNull();
    expect(doControle(2, 'quorum')).toContain('Do quórum.');
    expect(doControle(2, 'criterio')).toBeNull();
  });

  it('liga o controle recusado à recusa dele, e o grupo só à recusa da banca inteira', async () => {
    comDuasBancasDoMesmoTipo();

    await recusar('etapas[0].bancas[1].regraDeDeliberacao.quorum');

    expect(controle(2, 'quorum')?.getAttribute('aria-describedby')).toBe(
      'etapa-0-banca-banca-2-quorum-recusas',
    );
    expect(controle(2, 'quorum')?.getAttribute('aria-invalid')).toBe('true');
    expect(controle(1, 'quorum')?.getAttribute('aria-invalid')).toBeNull();
    expect(grupo(2)?.getAttribute('aria-describedby')).toBeNull();
    expect(grupo(2)?.getAttribute('aria-invalid')).toBeNull();
  });

  it('mostra a recusa da banca inteira junto do grupo, sem marcá-lo como inválido', async () => {
    comDuasBancasDoMesmoTipo();

    await recusar('etapas[0].bancas[1]');

    expect(daBanca(2)).toContain('Detalhe de etapas[0].bancas[1].');
    expect(vezes('Detalhe de etapas[0].bancas[1].')).toBe(1);
    expect(grupo(2)?.getAttribute('aria-describedby')).toBe('cr-etapa-bancas-0-banca-2-recusas');
    expect(grupo(2)?.getAttribute('aria-invalid')).toBeNull();
    expect(grupo(1)?.getAttribute('aria-describedby')).toBeNull();
  });

  it('mostra sob o modo a recusa do controle que a regra atual não mostra', async () => {
    const etapa = comDuasBancasDoMesmoTipo();
    declararRegraNaBanca(
      tela.edicao,
      etapa,
      'banca-2',
      comRegra({
        criterio: CRITERIOS.unanimidade.codigo,
        desempate: '',
        semUnanimidade: RESULTADOS.favoravel.codigo,
      }),
    );
    tela.detectar();

    await recusar('etapas[0].bancas[1].regraDeDeliberacao.desempate');

    expect(controle(2, 'desempate')).toBeNull();
    expect(doControle(2, 'modo')).toContain(
      'Detalhe de etapas[0].bancas[1].regraDeDeliberacao.desempate.',
    );
    expect(vezes('Detalhe de etapas[0].bancas[1].regraDeDeliberacao.desempate.')).toBe(1);
    expect(controle(2, 'modo')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('não repete no resumo da gravação a mensagem que já está junto da banca', async () => {
    comDuasBancasDoMesmoTipo();

    const resultado = await recusar('etapas[0].bancas[0].regraDeDeliberacao.criterio', CRITERIO);

    expect(resultado.messages).toEqual([RECUSA_MOSTRADA_NOS_CAMPOS]);
  });

  it('leva o foco ao controle da banca recusada', async () => {
    comDuasBancasDoMesmoTipo();

    await recusar('etapas[0].bancas[1].regraDeDeliberacao.quorum');
    await tela.proximoPasso();

    expect(document.activeElement).toBe(controle(2, 'quorum'));
  });

  it('mostra a recusa de código desconhecido uma vez junto do campo e leva o foco a ele', async () => {
    const etapa = comDuasBancasDoMesmoTipo();
    const valor = 'modoDesconhecido';
    declararRegraNaBanca(
      tela.edicao,
      etapa,
      'banca-2',
      comRegra({ modo: valor as ModoDeDeliberacao }),
    );
    tela.detectar();
    const mensagem = 'O modo de deliberação deve ser colegiada com votação ou ato individual';
    const codigo = 'uniplus.selecao.banca.modo_de_deliberacao_invalido';
    const requisicoes = vi.spyOn(tela.controller, 'expectOne');
    const resultado = await ajudantes.recusarEtapas([
      { field: 'etapas[0].bancas[1].regraDeDeliberacao.modo', code: codigo, message: mensagem },
    ]);
    await tela.proximoPasso();
    const enviada = requisicoes.mock.results.find((r) => r.value?.request.url === ROTA_ETAPAS);
    expect(JSON.stringify(enviada?.value.request.body)).toContain(valor);
    expect(doControle(2, 'modo')).toContain(mensagem);
    expect(doControle(2, 'modo')).toContain(codigo);
    expect(vezes(mensagem)).toBe(1);
    expect(doControle(2, 'modo')).not.toContain(valor);
    expect(vezes(valor)).toBe(0);
    expect(controle(2, 'modo')?.textContent).toContain('Valor não reconhecido');
    expect(resultado.messages).toEqual([RECUSA_MOSTRADA_NOS_CAMPOS]);
    expect(document.activeElement).toBe(controle(2, 'modo'));
  });

  it('leva o foco ao modo quando o controle recusado não está à vista', async () => {
    const etapa = comDuasBancasDoMesmoTipo();
    declararRegraNaBanca(
      tela.edicao,
      etapa,
      'banca-2',
      comRegra({
        criterio: CRITERIOS.unanimidade.codigo,
        desempate: '',
        semUnanimidade: RESULTADOS.favoravel.codigo,
      }),
    );
    tela.detectar();

    await recusar('etapas[0].bancas[1].regraDeDeliberacao.desempate');
    await tela.proximoPasso();

    expect(document.activeElement).toBe(controle(2, 'modo'));
  });

  it('leva o foco ao grupo da banca quando a recusa não aponta um controle dela', async () => {
    comDuasBancasDoMesmoTipo();

    await recusar('etapas[0].bancas[1]');
    await tela.proximoPasso();

    expect(document.activeElement).toBe(grupo(2));
  });

  it('deixa na seção, sem nota, a recusa que não aponta banca', async () => {
    comDuasBancasDoMesmoTipo();

    await recusar('etapas[0].bancas', 'uniplus.selecao.cronograma.recurso_sem_banca');

    expect(ajudantes.bloco(SECAO)).toContain('Detalhe de etapas[0].bancas.');
    expect(ajudantes.bloco(SECAO)).not.toContain(NOTA_DA_BANCA_AUSENTE);
    expect(daBanca(1)).toBeNull();
    expect(daBanca(2)).toBeNull();
  });

  it('leva à seção, com a nota, a recusa de banca retirada depois do envio', async () => {
    const etapa = comDuasBancasDoMesmoTipo();
    await recusar('etapas[0].bancas[1].regraDeDeliberacao.quorum');

    retirarBancaDaEtapa(tela.edicao, etapa, 'banca-2');
    tela.detectar();

    expect(ajudantes.bloco(SECAO)).toContain('Detalhe de etapas[0].bancas[1]');
    expect(ajudantes.bloco(SECAO)).toContain(NOTA_DA_BANCA_AUSENTE);
  });

  it('leva à seção, com a nota, a recusa de uma posição que o envio não tinha', async () => {
    comDuasBancasDoMesmoTipo();

    await recusar('etapas[0].bancas[5]');

    expect(ajudantes.bloco(SECAO)).toContain(NOTA_DA_BANCA_AUSENTE);
  });

  it('passa a conferir de novo quando a etapa muda, sem receber o foco nem marcar o controle', async () => {
    const etapa = comDuasBancasDoMesmoTipo();
    await recusar('etapas[0].bancas[1].regraDeDeliberacao.quorum');
    expect(tela.recusas.primeiraRecusaAtiva()).not.toBeNull();

    etapa.controls.notaMaxima.setValue('10');
    etapa.controls.notaMaxima.setValue('');
    tela.detectar();

    expect(tela.recusas.primeiraRecusaAtiva()).toBeNull();
    expect(doControle(2, 'quorum')).toContain('conferida de novo');
    expect(controle(2, 'quorum')?.getAttribute('aria-invalid')).toBeNull();
    expect(controle(2, 'quorum')?.getAttribute('aria-describedby')).toBe(
      'etapa-0-banca-banca-2-quorum-recusas',
    );
  });
  it('calcula as recusas das bancas uma vez por mudança, e não a cada leitura da tela', async () => {
    const etapa = comDuasBancasDoMesmoTipo();
    await recusar('etapas[0].bancas[1].regraDeDeliberacao.quorum');
    const calculo = vi.spyOn(
      tela.elementoDaTela.injector.get(RecusasDoServidorNasEtapas),
      'recusasDasBancas',
    );

    etapa.controls.notaMaxima.setValue('7');
    tela.detectar();
    etapa.controls.notaMaxima.setValue('8');
    tela.detectar();

    expect(calculo.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
