import { ComponentFixture } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { apiOk } from '@uniplus/shared-core/http';
import { StatusProcesso, type DocumentoDoAtoDto } from '@uniplus/shared-data/selecao';
import { errorResult, mockProblemDetails } from '@uniplus/shared-testing';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { RevisaoPassoComponent } from './revisao.component';
import {
  ATO_DO_PROCESSO,
  ATO_PUBLICADO,
  DOCUMENTO_ID,
  PROCESSO_DTO_MINIMO,
  ROTA_ATOS,
  ROTA_DETALHE,
  ROTA_PUBLICACAO,
  ROTA_SNAPSHOT,
  SNAPSHOT_DTO,
  criarProcesso,
  flushMicrotasks,
  flushProntidaoVerde,
  montarOCenario,
  prepararCamposLocais,
  CenarioDaRevisao,
} from './revisao.testing';

describe('RevisaoPassoComponent', () => {
  let cenario: CenarioDaRevisao;
  let fixture: ComponentFixture<RevisaoPassoComponent>;
  let componente: RevisaoPassoComponent;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;

  beforeEach(async () => {
    cenario = await montarOCenario();
    ({ fixture, componente, store, controller } = cenario);
  });

  afterEach(() => controller.verify());

  describe('processo já publicado', () => {
    async function abrirPublicado(): Promise<void> {
      store.remoteSnapshot.set(PROCESSO_DTO_MINIMO as never);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);
    }

    function texto(): string {
      return (fixture.nativeElement as HTMLElement).textContent ?? '';
    }

    /** Responde a consulta dos atos do processo, de onde vêm os anexos que a versão publicou. */
    async function responderAtos(anexos: readonly DocumentoDoAtoDto[] = []): Promise<void> {
      controller
        .expectOne(ROTA_ATOS)
        .flush([{ ...ATO_DO_PROCESSO, id: SNAPSHOT_DTO.atoId, anexos }]);
      await flushMicrotasks();
      fixture.detectChanges();
    }

    it('lê o ato vigente pelo snapshot e o mostra como texto, sem o formulário', async () => {
      await abrirPublicado();
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await flushMicrotasks();
      fixture.detectChanges();

      expect(cenario.atosLidos).toEqual([SNAPSHOT_DTO.atoId]);
      await responderAtos();
      const lista = (fixture.nativeElement as HTMLElement).querySelector(
        'dl[aria-label="Ato publicado"]',
      );
      expect(lista?.textContent).toContain('001/2026');
      expect(lista?.textContent).toContain('Portaria');
      expect(lista?.textContent).toContain('25/09/2026');
      expect(lista?.textContent).toContain('Reitor da Unifesspa');
      expect((fixture.nativeElement as HTMLElement).querySelector('#rev-numero')).toBeNull();
    });

    it('mostra a falha da leitura com "Tentar novamente", que lê de novo', async () => {
      cenario.respostaDoAto = of(errorResult(mockProblemDetails({ status: 503 })));
      await abrirPublicado();
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await flushMicrotasks();
      fixture.detectChanges();

      expect(texto()).toContain('Não foi possível ler o ato publicado');

      cenario.respostaDoAto = of(apiOk(ATO_PUBLICADO, 200, new HttpHeaders()));
      const botoes = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
      const botao = botoes.find((item) => item.textContent?.includes('Tentar novamente'));
      botao?.click();
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await flushMicrotasks();
      fixture.detectChanges();

      expect(texto()).toContain('Reitor da Unifesspa');
      expect(cenario.atosLidos).toHaveLength(2);
      await responderAtos();
    });

    it('mostra para leitura os anexos que o ato da versão vigente publicou', async () => {
      await abrirPublicado();
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await flushMicrotasks();
      fixture.detectChanges();
      await responderAtos([
        {
          documentoAPublicarId: DOCUMENTO_ID,
          nomeArquivo: 'cronograma.pdf',
          nomeDeExibicao: 'Cronograma detalhado.pdf',
          tipoDeMidia: 'application/pdf',
          hashSha256: 'a'.repeat(64),
        },
      ]);

      const bloco = (fixture.nativeElement as HTMLElement).querySelector('sel-anexos-do-edital');
      expect(bloco?.textContent).toContain('Cronograma detalhado.pdf');
      expect(bloco?.querySelector('input')).toBeNull();
    });

    it('depois de publicar nesta sessão, lê o ato pelo snapshot já relido', async () => {
      prepararCamposLocais(cenario);
      await criarProcesso(cenario);
      await flushProntidaoVerde(cenario);

      const gravacao = componente.persistir();
      controller.expectOne(ROTA_PUBLICACAO).flush(null, { status: 204, statusText: 'No Content' });
      await flushMicrotasks();
      controller.expectOne(ROTA_DETALHE).flush(PROCESSO_DTO_MINIMO);
      controller.expectOne(ROTA_SNAPSHOT).flush(SNAPSHOT_DTO);
      await gravacao;
      await flushMicrotasks();
      fixture.detectChanges();
      await flushMicrotasks();

      controller.expectNone(ROTA_SNAPSHOT);
      expect(cenario.atosLidos).toEqual([SNAPSHOT_DTO.atoId]);
      await responderAtos();
    });

    // Cancelado e encerrado não dizem se houve publicação: um rascunho cancelado não tem
    // snapshot vigente, e a transcrição que ele guarda precisa continuar na tela.
    it.each([StatusProcesso.rascunho, StatusProcesso.cancelado, StatusProcesso.encerrado])(
      'em %s não lê ato nenhum e mantém a transcrição',
      async (status) => {
        store.remoteSnapshot.set({ ...PROCESSO_DTO_MINIMO, status } as never);
        await criarProcesso(cenario);
        await flushProntidaoVerde(cenario);
        fixture.detectChanges();

        controller.expectNone(ROTA_SNAPSHOT);
        expect(cenario.atosLidos).toEqual([]);
        const tela = fixture.nativeElement as HTMLElement;
        // Rascunho a edita; cancelado e encerrado a leem como texto, sem campo.
        expect(tela.querySelector('#rev-numero') !== null).toBe(status === StatusProcesso.rascunho);
        if (status !== StatusProcesso.rascunho) {
          expect(tela.textContent).toContain('Número do ato');
        }
      },
    );
  });
});
