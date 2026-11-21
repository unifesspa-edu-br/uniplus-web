import { describe, expect, it } from 'vitest';
import { cronogramaDe, etapasDe } from '../../shared/hidratacao/hidratacao-do-cronograma';
import { faseDoServidor, etapaDoServidor } from '../../shared/cronograma-do-servidor.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';
import {
  ID_AVALIACAO,
  ID_BANCA_HETERO,
  PROCESSO_COM_ETAPA_GRAVADA,
  PROCESSO_ID,
  ROTA_ETAPAS,
  ROTA_FASES,
  ROTA_PROCESSO,
} from './cronograma.testing';

const AVISO =
  'O cronograma foi alterado fora desta tela durante a gravação. A tela passou a mostrar o que está gravado; confira as fases e as bancas antes de gravar de novo.';
const BANCA_NOVA = {
  id: null,
  identificadorLocal: 'nova',
  copiaDoTipo: null,
  tipoBancaId: ID_BANCA_HETERO,
  categoriasDocumentoIds: [],
  regraDeDeliberacao: null,
};

describe('Cronograma: divergência na releitura', () => {
  let tela: ContextoDoCronograma;
  usarCronograma((contexto) => {
    tela = contexto;
  });

  it.each([false, true])(
    'mostra as fases gravadas e destrava (nova tentativa: %s)',
    async (tentarNovamente) => {
      tela.store.processoSeletivoId.set(PROCESSO_ID);
      tela.comFaseAjustada(ID_AVALIACAO, { bancasRequeridas: [BANCA_NOVA] });
      tela.comUmaEtapa();
      const etapasAntes = tela.store.draft().cronograma.etapas;
      const dto = {
        ...PROCESSO_COM_ETAPA_GRAVADA,
        cronogramaFases: [
          faseDoServidor({
            faseCanonica: { origemId: ID_AVALIACAO },
            bancasRequeridas: [],
          }),
        ],
      };
      const gravacao = tela.componente.persistir();
      tela.controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
      await tela.proximoPasso();
      if (tentarNovamente) {
        tela.controller
          .expectOne(ROTA_PROCESSO)
          .flush(null, { status: 503, statusText: 'Indisponível' });
        await gravacao;
        expect(tela.releituraDosIdentificadores.pendente()).toBe('fases');
        const tentativa = tela.releituraDosIdentificadores.relerIdentificadores();
        tela.controller.expectOne(ROTA_PROCESSO).flush(dto);
        await tentativa;
      } else {
        tela.controller.expectOne(ROTA_PROCESSO).flush(dto);
        expect(await gravacao).toEqual({ valid: false, messages: [AVISO] });
      }
      tela.detectar();
      expect(tela.store.draft().cronograma.fases).toEqual(
        cronogramaDe(dto as unknown as Parameters<typeof cronogramaDe>[0]).fases,
      );
      expect(tela.store.draft().cronograma.etapas).toEqual(etapasAntes);
      expect(tela.releituraDosIdentificadores.aviso()).toBe(AVISO);
      expect(tela.releituraDosIdentificadores.pendente()).toBeNull();
      expect(tela.cronograma.edicaoLiberada()).toBe(true);
      tela.controller.expectNone(ROTA_ETAPAS);
    },
  );

  it.each([false, true])(
    'mostra as etapas gravadas e destrava (nova tentativa: %s)',
    async (tentarNovamente) => {
      tela.store.processoSeletivoId.set(PROCESSO_ID);
      tela.comFases(ID_AVALIACAO);
      tela.comUmaEtapa();
      const fasesAntes = tela.store.draft().cronograma.fases;
      const dto = {
        ...PROCESSO_COM_ETAPA_GRAVADA,
        etapas: [etapaDoServidor({ identificacao: { ordem: 2, nome: 'Etapa alterada' } })],
      };
      const gravacao = tela.componente.persistir();
      tela.controller.expectOne(ROTA_FASES).flush(null, { status: 204, statusText: 'No Content' });
      await tela.proximoPasso();
      tela.controller.expectOne(ROTA_ETAPAS).flush(null, { status: 204, statusText: 'No Content' });
      await tela.proximoPasso();
      if (tentarNovamente) {
        tela.controller
          .expectOne(ROTA_PROCESSO)
          .flush(null, { status: 503, statusText: 'Indisponível' });
        await gravacao;
        expect(tela.releituraDosIdentificadores.pendente()).toBe('etapas');
        const tentativa = tela.releituraDosIdentificadores.relerIdentificadores();
        tela.controller.expectOne(ROTA_PROCESSO).flush(dto);
        await tentativa;
      } else {
        tela.controller.expectOne(ROTA_PROCESSO).flush(dto);
        expect(await gravacao).toEqual({ valid: false, messages: [AVISO] });
      }
      tela.detectar();
      expect(tela.store.draft().cronograma.etapas).toEqual(
        etapasDe(dto as unknown as Parameters<typeof etapasDe>[0]),
      );
      expect(tela.store.draft().cronograma.fases).toEqual(fasesAntes);
      expect(tela.releituraDosIdentificadores.aviso()).toBe(AVISO);
      expect(tela.releituraDosIdentificadores.pendente()).toBeNull();
      expect(tela.cronograma.edicaoLiberada()).toBe(true);
    },
  );
});
