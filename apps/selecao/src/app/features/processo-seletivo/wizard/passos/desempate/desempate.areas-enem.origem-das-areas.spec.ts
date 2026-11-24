import { StatusProcessoCodigo, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CLASSIFICACAO_COM_QUADRO,
  RESOLUCAO,
  OUTRA_RESOLUCAO,
  ROTA_PESOS,
  TECNOLOGICA,
  SAUDE,
  QUADRO_CONGELADO,
  COPIA_COM_LINGUAGENS_E_REDACAO,
  area,
  criterio,
} from './desempate.areas-enem.dados.testing';
import {
  montar,
  responderPendentes,
  classificacaoGravada,
  criterioPorArea,
  seletor,
  opcoesDoSeletor,
  areasNaTela,
  areasEmConsulta,
  textoDaTela,
  areasDoDesempate,
  conferirERestaurar,
} from './desempate.areas-enem.montagem.testing';

describe('DesempatePassoComponent — ordem das áreas do ENEM: origem das áreas', () => {
  afterEach(conferirERestaurar);

  describe('de onde vêm as áreas', () => {
    it('antes de gravada a classificação, oferece as áreas comuns da resolução escolhida, na ordem canônica', async () => {
      const m = await montar();
      criterioPorArea(m);

      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação', 'Matemática']);
    });

    it('depois de gravada a classificação, antes de ler o cadastro, as áreas vêm da cópia congelada', async () => {
      const m = await montar({
        antesDeMontar: classificacaoGravada(RESOLUCAO, QUADRO_CONGELADO),
        semResponderPesos: true,
      });
      criterioPorArea(m);

      expect(opcoesDoSeletor(m, 0)).toEqual(['Linguagens']);
      // A leitura do cadastro fica sem resposta: aqui só importa a cópia.
      m.controller.match((r) => r.url.endsWith(ROTA_PESOS)).forEach((r) => r.flush([]));
    });

    it('com a mesma resolução mudada no cadastro, oferece só as áreas que a cópia e o cadastro aceitam', async () => {
      const m = await montar({
        antesDeMontar: classificacaoGravada(RESOLUCAO, COPIA_COM_LINGUAGENS_E_REDACAO),
      });
      criterioPorArea(m);

      // A próxima gravação da classificação copia o cadastro, que não tem Linguagens.
      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação']);
      expect(textoDaTela(m)).toContain(
        `A resolução ${RESOLUCAO} mudou no cadastro desde a gravação`,
      );
    });

    it('com resoluções sem área em comum, diz isso, e não que falta área comum aos grupos', async () => {
      const m = await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: OUTRA_RESOLUCAO },
        antesDeMontar: classificacaoGravada(
          RESOLUCAO,
          [TECNOLOGICA, SAUDE].map((grupo) => ({
            grupoAreaEnem: grupo,
            baseLegal: 'Anexo I',
            areas: [area('REDACAO', 'Redação')],
          })),
        ),
      });
      criterioPorArea(m);

      expect(seletor(m, 0)).toBeNull();
      expect(textoDaTela(m)).toContain(
        `A resolução ${RESOLUCAO}, gravada, e a ${OUTRA_RESOLUCAO}, escolhida no passo Fórmula, não têm área em comum a todos os grupos`,
      );
    });

    it('com o rascunho noutra resolução, oferece só as áreas que as duas resoluções aceitam', async () => {
      const m = await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: OUTRA_RESOLUCAO },
        antesDeMontar: classificacaoGravada(RESOLUCAO, COPIA_COM_LINGUAGENS_E_REDACAO),
      });
      criterioPorArea(m);

      expect(opcoesDoSeletor(m, 0)).toEqual(['Linguagens']);
      expect(textoDaTela(m)).toContain(
        `Só as áreas que a resolução ${RESOLUCAO}, gravada, e a ${OUTRA_RESOLUCAO}, escolhida no passo Fórmula, têm em todos os grupos podem desempatar`,
      );

      // Redação vale na gravada, mas a próxima gravação da classificação a recusaria.
      m.store.patchSection('desempate', [criterio(['REDACAO'])]);
      expect(m.componente.validar()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: a área Redação não é comum a todos os grupos da resolução de Peso por Área.',
        ],
      });
    });

    it('com o rascunho sem a resolução escolhida, fica na gravada e diz que a mudança espera a Eliminação', async () => {
      const m = await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: '' },
        antesDeMontar: classificacaoGravada(RESOLUCAO, COPIA_COM_LINGUAGENS_E_REDACAO),
      });
      criterioPorArea(m);

      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação', 'Linguagens']);
      expect(textoDaTela(m)).toContain(
        `As áreas vêm da resolução ${RESOLUCAO}, a da classificação gravada. O que mudou no passo Fórmula`,
      );
    });

    it('com o rascunho fora do ENEM pela média ponderada, não oferece áreas e recusa o critério, que a Eliminação recusaria', async () => {
      const m = await montar({
        classificacao: null,
        antesDeMontar: (store) => {
          classificacaoGravada(RESOLUCAO, COPIA_COM_LINGUAGENS_E_REDACAO)(store);
          store.patchSection('desempate', [criterio(['REDACAO'])]);
        },
      });
      responderPendentes(m.controller);
      m.fixture.detectChanges();

      expect(seletor(m, 0)).toBeNull();
      // O que já está configurado continua à vista, para ser retirado.
      expect(areasNaTela(m, 0)).toEqual(['1ª Redação']);
      expect(m.componente.validar()).toEqual({
        valid: false,
        messages: [
          'Critério de desempate 1: a classificação escolhida no passo Fórmula não é baseada no ENEM pela média ponderada, e a gravação dela no passo Eliminação vai recusar o critério por área; troque a regra do critério ou remova-o, ou volte a classificação para o ENEM no passo Fórmula.',
        ],
      });
    });

    it('com a classificação gravada sem ENEM e o rascunho já com ENEM, oferece as áreas do cadastro', async () => {
      const m = await montar({ antesDeMontar: classificacaoGravada(null, []) });
      criterioPorArea(m);

      // A gravação da classificação copia o quadro, e os critérios só são gravados depois dela.
      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação', 'Matemática']);
      expect(textoDaTela(m)).toContain('serão gravados junto com a classificação');
    });

    it('com a classificação gravada sem ENEM e o rascunho com ENEM ainda sem resolução, pede a resolução', async () => {
      const m = await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: '' },
        antesDeMontar: classificacaoGravada(null, []),
      });
      criterioPorArea(m);

      expect(textoDaTela(m)).toContain('Escolha a resolução de Peso por Área no passo Fórmula');
    });

    it('só para consulta e sem cópia gravada, lê o cadastro em vez de esperar para sempre', async () => {
      const m = await montar({
        antesDeMontar: (store) => {
          store.patchSection('desempate', [criterio(['REDACAO'])]);
          store.remoteSnapshot.set({
            status: StatusProcessoCodigo.PUBLICADO,
          } as unknown as ProcessoSeletivoDto);
        },
      });

      expect(textoDaTela(m)).not.toContain('Carregando as áreas');
      expect(areasEmConsulta(m, 0)).toEqual(['Redação']);
    });

    it('uma tecla em outro passo não recalcula o quadro', async () => {
      const m = await montar();
      const antes = areasDoDesempate(m).situacaoDoQuadro();

      m.store.patchObjectSection('identificacao', { nome: 'Processo de teste' });

      expect(areasDoDesempate(m).situacaoDoQuadro()).toBe(antes);
    });

    it('sem área em comum entre a cópia e a resolução escolhida, as áreas citadas saem pelo rótulo da cópia', async () => {
      const copia = [TECNOLOGICA, SAUDE].map((grupo) => ({
        grupoAreaEnem: grupo,
        baseLegal: 'Anexo I',
        areas: [area('AREA_DA_COPIA', 'Área da cópia')],
      }));
      const m = await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: OUTRA_RESOLUCAO },
        antesDeMontar: (store) => {
          store.patchSection('desempate', [criterio(['AREA_DA_COPIA'])]);
          classificacaoGravada(RESOLUCAO, copia)(store);
        },
      });

      expect(areasDoDesempate(m).situacaoDoQuadro().tipo).toBe('resolucoes-sem-area-em-comum');
      expect(areasNaTela(m, 0)).toEqual(['1ª Área da cópia']);
    });

    it('liga ao seletor e à lista a dica que explica de onde vêm as áreas', async () => {
      const m = await montar({
        classificacao: { ...CLASSIFICACAO_COM_QUADRO, resolucaoPesoAreaEnem: OUTRA_RESOLUCAO },
        antesDeMontar: classificacaoGravada(RESOLUCAO, COPIA_COM_LINGUAGENS_E_REDACAO),
      });
      m.store.patchSection('desempate', [criterio(['LINGUAGENS'])]);
      m.fixture.detectChanges();

      const dica = m.el.querySelector('#desemp-areas-dica-0');
      expect(dica?.textContent).toContain('Só as áreas que a resolução');
      expect(seletor(m, 0)?.getAttribute('aria-describedby')).toBe('desemp-areas-dica-0');
      expect(
        m.el
          .querySelector('[aria-labelledby="desemp-areas-rotulo-0"]')
          ?.getAttribute('aria-describedby'),
      ).toBe('desemp-areas-dica-0');
    });

    it('sem ressalva sobre a origem das áreas, não liga dica nenhuma', async () => {
      const m = await montar();
      criterioPorArea(m);

      expect(seletor(m, 0)?.hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('depois de gravada nesta sessão uma classificação sem ENEM', () => {
    it('com o rascunho já pelo ENEM, oferece as áreas do cadastro, que a próxima gravação copia', async () => {
      const m = await montar({
        antesDeMontar: (store) => store.classificacao.registrarGravadaSemQuadro(),
      });
      criterioPorArea(m);

      expect(opcoesDoSeletor(m, 0)).toEqual(['Redação', 'Matemática']);
    });
  });

  it('só para consulta, lê as áreas gravadas pelo rótulo da cópia, sem ler o cadastro nem oferecer edição', async () => {
    const m = await montar({
      antesDeMontar: (store) => {
        store.patchSection('desempate', [criterio(['LINGUAGENS'])]);
        // Com Matemática ainda por citar, só o modo consulta não oferece o seletor e o botão.
        classificacaoGravada(
          RESOLUCAO,
          QUADRO_CONGELADO.map((grupo) => ({
            ...grupo,
            areas: [...grupo.areas, area('MATEMATICA', 'Matemática')],
          })),
          StatusProcessoCodigo.PUBLICADO,
        )(store);
      },
      // Uma leitura do cadastro sairia sem resposta, e a conferência do fim do teste a acusaria.
      semResponderPesos: true,
    });

    expect(areasEmConsulta(m, 0)).toEqual(['Linguagens']);
    expect(m.el.querySelector('select, input, button')).toBeNull();
  });
});
