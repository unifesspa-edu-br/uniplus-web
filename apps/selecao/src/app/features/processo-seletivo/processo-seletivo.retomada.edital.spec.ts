import type { DocumentoAPublicarDto } from '@uniplus/shared-data/selecao';
import { TestBed } from '@angular/core/testing';
import { FinalidadeDoDocumentoCodigo } from '@uniplus/shared-data/selecao';
import { errorResult, mockProblemDetails, okResult } from '@uniplus/shared-testing';
import { BehaviorSubject, from, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PROCESSO_ID,
  MONTAGEM_LENTA,
  documento,
  montar,
  propagar,
} from './processo-seletivo.retomada.testing';

describe('ProcessoSeletivoPage — edital na retomada', MONTAGEM_LENTA, () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('restaura o vínculo quando há um único documento confirmado', async () => {
    const listar = vi.fn(() => of(okResult([documento()])));
    const cenario = montar({ listarDocumentos: listar });
    await propagar();

    // Os anexos do edital vivem na mesma coleção e não disputam o posto de oficial.
    expect(listar).toHaveBeenCalledWith(
      PROCESSO_ID,
      FinalidadeDoDocumentoCodigo.DOCUMENTO_DO_EDITAL,
    );

    const uploads = cenario.store.draft().identificacao.uploads;
    expect(uploads).toHaveLength(1);
    expect(uploads[0].documentoAPublicarId).toBe('019f41cf-69fd-759a-ac6d-09acabc1b030');
    expect(uploads[0].name).toBe('edital-de-abertura.pdf');
    expect(cenario.store.documentosParaEscolha()).toHaveLength(0);
  });

  /**
   * Adotar o mais recente trocaria o edital do certame sem o operador
   * perceber. Nenhum é vinculado até haver decisão.
   */
  it('não elege o oficial quando há mais de um documento confirmado', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() =>
        of(
          okResult([
            documento(),
            documento({
              id: '019f41cf-69fd-759a-ac6d-09acabc1b031',
              confirmadoEm: '2026-08-21T09:00:00Z',
            }),
          ]),
        ),
      ),
    });
    await propagar();

    expect(cenario.store.documentosParaEscolha()).toHaveLength(2);
    expect(cenario.store.draft().identificacao.uploads).toHaveLength(0);
  });

  /**
   * Enviar outro edital durante a escolha criaria um terceiro documento
   * imutável, agravando a ambiguidade que a escolha existe para resolver.
   */
  it('bloqueia o envio de novo edital enquanto a escolha está pendente', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() =>
        of(okResult([documento(), documento({ id: '019f41cf-69fd-759a-ac6d-09acabc1b031' })])),
      ),
    });
    await propagar();
    cenario.fixture.detectChanges();

    const zona = cenario.host.querySelector('.uni-uploader__drop');
    expect(zona?.getAttribute('aria-disabled')).toBe('true');

    // O input é visualmente oculto mas focável: bloquear só a zona deixaria a
    // navegação por teclado burlar a escolha.
    const input = cenario.host.querySelector<HTMLInputElement>('input[type=file]');
    expect(input?.disabled).toBe(true);
  });

  /**
   * Dois confirmados no mesmo minuto renderizavam botões idênticos — pedir
   * escolha entre opções indistinguíveis é pior do que escolher sozinho, e o
   * contrato não devolve nome de arquivo nem oferece rota de download. Restam
   * os metadados: instante com segundos, tamanho e início do hash.
   */
  it('distingue documentos confirmados no mesmo minuto', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() =>
        of(
          okResult([
            documento({
              confirmadoEm: '2026-08-20T12:05:10Z',
              tamanhoBytes: 2048,
              hashSha256: 'a'.repeat(64),
            }),
            documento({
              id: '019f41cf-69fd-759a-ac6d-09acabc1b031',
              confirmadoEm: '2026-08-20T12:05:40Z',
              tamanhoBytes: 4096,
              hashSha256: 'b'.repeat(64),
            }),
          ]),
        ),
      ),
    });
    await propagar();
    cenario.fixture.detectChanges();

    // Cada documento oferece duas ações — usar e abrir para conferir —, então o
    // que identifica a opção é o rótulo da escolha, não a contagem de botões.
    const rotulos = Array.from(
      cenario.host.querySelectorAll('.ps-doc-escolha button') as NodeListOf<HTMLButtonElement>,
    )
      .map((b) => b.getAttribute('aria-label'))
      .filter((rotulo): rotulo is string => rotulo?.startsWith('Usar o documento') ?? false);

    expect(rotulos).toHaveLength(2);
    expect(rotulos[0]).not.toBe(rotulos[1]);
    expect(rotulos[0]).toContain('aaaaaaaaaaaa');
    expect(rotulos[1]).toContain('bbbbbbbbbbbb');
    expect(rotulos[0]).toContain('2,0 KB');
    expect(rotulos[1]).toContain('4,0 KB');
    // Segundos separam o que o minuto não separa.
    expect(rotulos[0]).toContain(':10');
    expect(rotulos[1]).toContain(':40');
  });

  it('ignora documentos pendentes ao restaurar o vínculo', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() =>
        of(
          okResult([
            documento({
              status: {
                codigo: 'PENDENTE' as DocumentoAPublicarDto['status']['codigo'],
                rotulo: 'Pendente',
              },
              confirmadoEm: null,
            }),
          ]),
        ),
      ),
    });
    await propagar();

    expect(cenario.store.draft().identificacao.uploads).toHaveLength(0);
    expect(cenario.store.documentosParaEscolha()).toHaveLength(0);
  });

  /** O processo foi lido; só o anexo não pôde ser verificado. */
  it('mantém o editor utilizável quando a leitura dos documentos falha', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() => of(errorResult(mockProblemDetails({ status: 503 })))),
    });
    await propagar();

    expect(cenario.store.falhaDeLeitura()).toBeNull();
    expect(cenario.store.processoSeletivoId()).toBe(PROCESSO_ID);
  });

  /**
   * Um aviso guardado em signal e nunca renderizado não protege ninguém: o
   * operador veria o controle de upload vazio e concluiria que não há edital
   * anexado, criando um segundo documento imutável.
   */
  it('mostra na tela o aviso de que o anexo não pôde ser verificado', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() => of(errorResult(mockProblemDetails({ status: 503 })))),
    });
    await propagar();
    cenario.fixture.detectChanges();

    expect(cenario.store.avisoDocumentos()).not.toBeNull();
    expect(cenario.host.textContent).toContain('já tem edital anexado');
  });

  /**
   * A API aceita um segundo documento sem recusar — `IniciarPendente` não
   * confere se já há confirmado. Com a verificação falha, anexar é apostar que
   * não existe edital; o bloqueio dura só enquanto o estado é desconhecido.
   */
  it('trava o anexo enquanto o estado dos documentos é desconhecido', async () => {
    const cenario = montar({
      listarDocumentos: vi.fn(() => of(errorResult(mockProblemDetails({ status: 503 })))),
    });
    await propagar();
    cenario.fixture.detectChanges();

    const input = cenario.host.querySelector<HTMLInputElement>('input[type=file]');
    expect(input?.disabled).toBe(true);
    expect(cenario.host.querySelector('.uni-uploader__drop')?.getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  /** Travar sem saída deixaria o operador preso: o aviso oferece refazer. */
  it('destrava o anexo quando a reverificação encontra o processo sem edital', async () => {
    const listar = vi
      .fn()
      .mockReturnValueOnce(of(errorResult(mockProblemDetails({ status: 503 }))))
      .mockReturnValueOnce(of(okResult([])));
    const cenario = montar({ listarDocumentos: listar });
    await propagar();
    cenario.fixture.detectChanges();

    const botao = Array.from(
      cenario.host.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.textContent?.includes('Verificar novamente')) as HTMLButtonElement;
    expect(botao).toBeDefined();

    botao.click();
    await propagar();
    cenario.fixture.detectChanges();

    expect(listar).toHaveBeenCalledTimes(2);
    expect(cenario.store.avisoDocumentos()).toBeNull();
    expect(cenario.host.querySelector<HTMLInputElement>('input[type=file]')?.disabled).toBe(false);
  });

  it('não avisa quando a leitura dos documentos funciona', async () => {
    const cenario = montar();
    await propagar();
    cenario.fixture.detectChanges();

    expect(cenario.store.avisoDocumentos()).toBeNull();
    expect(cenario.host.textContent).not.toContain('já tem edital anexado');
  });

  /**
   * O detalhe já hidratou, os documentos ainda não; um endereço recusado no
   * meio superava a leitura e deixava `hidratando` ligado, e a volta ao
   * processo encontrava o editor preso no indicador de progresso.
   */
  it('não deixa o editor preso no carregamento após um endereço recusado', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const listar = vi.fn(() => from(new Promise(() => undefined)));
    const cenario = montar({ id: PROCESSO_ID, paramMap, listarDocumentos: listar });
    await propagar();
    await propagar();
    expect(cenario.store.hidratando()).toBe(true);

    // O desvio encerra o carregamento de A: a resposta pendente foi superada e
    // não há mais nada para esperar. Voltar ao processo relê — isso é assunto
    // do caso `relê os documentos ao voltar de um desvio que interrompeu a
    // leitura`, e é o que impede o editor de ficar sem saber do edital.
    paramMap.next({ get: () => 'nao-e-uuid' });
    await propagar();

    expect(cenario.store.hidratando()).toBe(false);
    expect(cenario.store.falhaDeLeitura()?.motivo).toBe('idInvalido');
  });

  /**
   * Limpar `hidratando` sem reler deixava o editor sem saber se o processo tem
   * edital: aviso nulo, anexo destravado, e a porta aberta para um segundo
   * documento imutável. Voltar de um desvio que interrompeu a leitura relê.
   */
  it('relê os documentos ao voltar de um desvio que interrompeu a leitura', async () => {
    const paramMap = new BehaviorSubject<{ get: (k: string) => string | null }>({
      get: () => PROCESSO_ID,
    });
    const listar = vi
      .fn()
      .mockReturnValueOnce(from(new Promise(() => undefined)))
      .mockReturnValue(of(okResult([documento()])));

    const cenario = montar({ id: PROCESSO_ID, paramMap, listarDocumentos: listar });
    await propagar();
    await propagar();
    expect(cenario.store.hidratando()).toBe(true);

    paramMap.next({ get: () => 'nao-e-uuid' });
    await propagar();

    paramMap.next({ get: () => PROCESSO_ID });
    await propagar();
    await propagar();
    await propagar();

    expect(listar).toHaveBeenCalledTimes(2);
    expect(cenario.store.draft().identificacao.uploads).toHaveLength(1);
    expect(cenario.store.hidratando()).toBe(false);
  });
});
