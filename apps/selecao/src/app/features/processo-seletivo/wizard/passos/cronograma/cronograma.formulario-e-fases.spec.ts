import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CatalogoDeBancas } from './catalogos/catalogo-de-bancas.service';
import {
  PROCESSO_ID,
  ROTA_ETAPAS,
  ID_INSCRICAO,
  ID_AVALIACAO,
  FASE_SUMIDA,
  TIPO_ETAPA_SO_ELIMINA,
} from './cronograma.testing';
import { type ContextoDoCronograma, usarCronograma } from './cronograma-passo.testing';

describe('CronogramaPassoComponent: formulário e fases', () => {
  let componente: ContextoDoCronograma['componente'];
  let expansao: ContextoDoCronograma['expansao'];
  let leitura: ContextoDoCronograma['leitura'];
  let edicao: ContextoDoCronograma['edicao'];
  let conferencia: ContextoDoCronograma['conferencia'];
  let cronograma: ContextoDoCronograma['cronograma'];
  let store: ContextoDoCronograma['store'];
  let controller: ContextoDoCronograma['controller'];
  let detectar: ContextoDoCronograma['detectar'];
  let nativo: ContextoDoCronograma['nativo'];
  let proximoPasso: ContextoDoCronograma['proximoPasso'];
  let comFases: ContextoDoCronograma['comFases'];
  let comFasesCongeladas: ContextoDoCronograma['comFasesCongeladas'];
  let comEtapasEmFases: ContextoDoCronograma['comEtapasEmFases'];
  let comUmaEtapa: ContextoDoCronograma['comUmaEtapa'];

  usarCronograma((tela) => {
    ({
      componente,
      expansao,
      leitura,
      edicao,
      conferencia,
      cronograma,
      store,
      controller,
      detectar,
      nativo,
      proximoPasso,
      comFases,
      comFasesCongeladas,
      comEtapasEmFases,
      comUmaEtapa,
    } = tela);
  });

  describe('falha dos catálogos exigidos', () => {
    const botaoDeTentar = (): HTMLButtonElement =>
      Array.from(nativo.querySelectorAll('button')).find(
        (botao) => botao.textContent?.trim() === 'Tentar novamente',
      ) as HTMLButtonElement;
    const situacao = (): string =>
      nativo.querySelector('ui-situacao-da-nova-tentativa')?.textContent ?? '';

    function recusarOsCatalogos(): void {
      TestBed.inject(CatalogoDeBancas).erro.set('Não foi possível carregar as bancas.');
      detectar();
    }

    it('a falha troca o editor pelo aviso, e a nova tentativa o mantém ao lado da espera', async () => {
      recusarOsCatalogos();
      expect(nativo.querySelector('ui-alert .alert__title')?.textContent).toBe(
        'Não foi possível carregar os catálogos',
      );
      expect(nativo.querySelector('sel-nova-fase')).toBeNull();

      botaoDeTentar().click();
      detectar();

      expect(situacao()).toBe('Tentando novamente…');
      expect(nativo.querySelector('ui-alert')).not.toBeNull();
      expect(nativo.textContent).toContain('Carregando fases, bancas, atos e regras…');
      expect(nativo.querySelectorAll('[role="status"]')).toHaveLength(1);

      for (const requisicao of controller.match(() => true)) requisicao.flush([]);
      await proximoPasso();
      detectar();

      expect(nativo.querySelector('ui-alert')).toBeNull();
      expect(nativo.textContent).not.toContain('Carregando fases, bancas, atos e regras…');
    });
  });

  /**
   * O rascunho é o que persiste entre passos e o que a hidratação preenche. O
   * formulário precisa refletir o que chega de fora — sem isso, reabrir um
   * processo mostraria a linha do tempo vazia sobre um cronograma que existe.
   */
  it('espelha no formulário o cronograma que chega ao rascunho', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comUmaEtapa();

    expect(cronograma.fases.length).toBe(2);
    expect(cronograma.fases.at(0).controls.faseCanonicaId.value).toBe(ID_INSCRICAO);
    expect(cronograma.fases.at(0).controls.inicio.value).toBe('2026-03-01T08:00');
    expect(cronograma.etapas.length).toBe(1);
    expect(cronograma.etapas.at(0).controls.nome.value).toBe('Prova objetiva');
  });

  /**
   * O caminho de volta: o que se digita no controle é o que a gravação envia, e
   * o que os outros passos leem pelo rascunho.
   */
  /**
   * O rascunho é reescrito a cada tecla pelo caminho de volta, e o espelho
   * responde a essa mudança. Se ele reconstruísse os controles quando o
   * conteúdo é o mesmo, o campo em que se digita seria recriado a cada letra —
   * e o foco iria embora junto.
   */
  it('não recria os controles quando o rascunho recebe o que já está na tela', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comUmaEtapa();
    const antes = cronograma.fases.controls;
    const antesEtapa = cronograma.etapas.at(0);

    cronograma.fases.at(0).controls.inicio.setValue('2026-03-02T09:00');
    detectar();

    expect(cronograma.fases.controls[0]).toBe(antes[0]);
    expect(cronograma.fases.controls[1]).toBe(antes[1]);
    expect(cronograma.etapas.at(0)).toBe(antesEtapa);
  });

  it('leva ao rascunho o que foi digitado no controle', () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();

    cronograma.etapas.at(0).controls.peso.setValue('2,5');

    expect(store.draft().cronograma.etapas[0].peso).toBe('2,5');
  });

  /**
   * Fora de rascunho — e durante uma gravação — o passo não aceita digitação. O
   * formulário acompanha o que o wizard já decide para os outros passos, em vez
   * de deixar campos editáveis cujo valor não teria para onde ir.
   */
  it('desabilita os controles enquanto o passo não aceita edição', () => {
    comFases(ID_INSCRICAO);
    expect(cronograma.formulario.enabled).toBe(true);

    // `salvando` é o outro motivo pelo qual o passo para de aceitar digitação,
    // e o que este teste alcança sem simular um processo publicado inteiro.
    store.salvando.set(true);
    detectar();

    expect(cronograma.formulario.disabled).toBe(true);
  });

  /**
   * O que a fase congelou vale sobre o catálogo, não o contrário. Editar a fase
   * canônica depois que um processo a congelou não pode mudar o que aquele
   * processo exige — ligar `agrupaEtapas` faria a conferência cobrar etapas de
   * um edital que nunca as teve.
   */
  it('descreve a fase pelo que ela congelou, mesmo com o catálogo dizendo outra coisa', () => {
    comFasesCongeladas({ id: ID_INSCRICAO, agrupaEtapas: true });

    const item = cronograma.linhaDoTempo()[0];

    expect(
      item.exigencias?.agrupaEtapas,
      'o catálogo diz que COLETA_INSCRICAO não agrupa; o processo congelou que agrupa',
    ).toBe(true);
    expect(item.foraDoCatalogo).toBe(false);
  });

  /**
   * A fase removida some do catálogo, mas continua no processo. Conferir só
   * pelo catálogo vivo faria as etapas dela parecerem órfãs, e a gravação nunca
   * sairia.
   */
  it('confere pela fase congelada quando a entrada saiu do catálogo', () => {
    comFasesCongeladas({ id: FASE_SUMIDA, agrupaEtapas: true });
    comUmaEtapa();

    expect(cronograma.linhaDoTempo()[0].foraDoCatalogo).toBe(true);
    expect(conferencia.problemas()).not.toContainEqual(
      expect.stringContaining('fase de avaliação que as agrupa'),
    );
  });

  it('oferece cada fase canônica uma vez só', () => {
    comFases(ID_INSCRICAO);

    const disponiveis = cronograma.fasesDisponiveis().map((fase) => fase.id);

    expect(disponiveis).not.toContain(ID_INSCRICAO);
    expect(disponiveis).toContain(ID_AVALIACAO);
  });

  /**
   * A última fase sai como qualquer outra.
   *
   * Travar o botão obrigava a acrescentar a fase certa ANTES de tirar a errada — ordem
   * invertida para quem escolheu a fase errada e só tem aquela. O cronograma vazio continua
   * recusado, mas pela conferência do passo, que é onde as demais faltas também aparecem:
   * a tela deixa editar e diz o que falta antes de gravar, em vez de impedir a edição.
   */
  it('deixa remover a última fase, e a conferência é quem cobra o cronograma vazio', () => {
    comFases(ID_INSCRICAO);

    cronograma.removerFase(0);

    expect(store.draft().cronograma.fases).toHaveLength(0);
    expect(conferencia.validar().messages).toContain('O cronograma precisa de ao menos uma fase.');
  });

  /**
   * As etapas vivem no agregado, não na fase. Removê-la sem levá-las deixaria
   * etapas sem a fase que as avalia — e a recusa só apareceria na publicação,
   * apontando para outro lugar.
   */
  // ── Linha do tempo colapsada ──

  /**
   * O passo se chama linha do tempo, e é isso que ele mostra ao abrir: os cabeçalhos das
   * fases. Com tudo aberto, o certame com sete fases tinha trinta e sete telas de rolagem.
   */
  it('abre com todas as fases fechadas', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);

    expect(expansao.faseExpandida(0)).toBe(false);
    expect(expansao.faseExpandida(1)).toBe(false);
    expect(nativo.querySelectorAll('.fase-bloco--aberta')).toHaveLength(0);
  });

  it('abre e fecha a fase pelo cabeçalho', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);

    expansao.alternarFase(1);
    detectar();
    expect(expansao.faseExpandida(1)).toBe(true);
    expect(expansao.faseExpandida(0), 'abrir uma não fecha a outra').toBe(false);

    expansao.alternarFase(1);
    expect(expansao.faseExpandida(1)).toBe(false);
  });

  /** Fechada, a fase diz o que há dentro dela — senão abrir vira tentativa e erro. */
  it('a fase fechada conta as etapas que acontecem nela', () => {
    comFases(ID_INSCRICAO, ID_AVALIACAO);
    comEtapasEmFases(['AVALIACAO', 'AVALIACAO', 'COLETA_INSCRICAO']);

    expect(leitura.marcasDaFase(1)).toEqual(['2 etapas']);
    expect(leitura.marcasDaFase(0)).toEqual(['1 etapa']);
  });

  /**
   * A conferência acusa problemas em qualquer fase, e a mensagem aponta para uma que pode
   * estar fechada. Recusar sem abrir deixaria o operador procurando o erro no escuro.
   */
  it('a recusa da conferência abre todas as fases', async () => {
    store.processoSeletivoId.set(PROCESSO_ID);
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    cronograma.etapas.at(0).controls.nome.setValue('');
    detectar();

    const resultado = await componente.persistir();

    expect(resultado.valid).toBe(false);
    expect(expansao.faseExpandida(0)).toBe(true);
    controller.expectNone(ROTA_ETAPAS);
  });

  /**
   * O recorte vem do cadastro, não de uma lista de códigos na tela: um tipo que não compõe a
   * nota final não pode oferecer caráter que pontua, e é isso que faz o peso desaparecer.
   */
  it('o caráter oferecido segue o que o tipo de etapa admite', () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    const etapa = cronograma.etapas.at(0);

    expect(edicao.caracteresPara(etapa).map((o) => o.valor)).toEqual([
      'classificatoria',
      'eliminatoria',
      'ambas',
    ]);

    edicao.escolherTipoEtapa(etapa, TIPO_ETAPA_SO_ELIMINA);
    detectar();

    expect(edicao.caracteresPara(etapa).map((o) => o.valor)).toContain('eliminatoria');
    expect(edicao.caracteresPara(etapa).map((o) => o.valor)).not.toContain('ambas');
  });

  /**
   * Trocar o tipo não apaga o caráter já declarado: o campo continuaria mostrando um valor que
   * o cadastro recusa, e a recusa da gravação não diria qual. Ele fica na lista, nomeado.
   */
  it('o caráter que o tipo deixou de admitir permanece visível, marcado', () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    const etapa = cronograma.etapas.at(0);

    edicao.escolherTipoEtapa(etapa, TIPO_ETAPA_SO_ELIMINA);
    detectar();

    expect(etapa.controls.carater.value, 'o valor declarado permanece').toBe('classificatoria');
    const marcada = edicao.caracteresPara(etapa).find((opcao) => opcao.valor === 'classificatoria');
    expect(marcada?.rotulo).toContain('não mais admitido');
  });

  /** Sem tipo escolhido o cadastro não tem o que restringir — a etapa ainda não se declarou. */
  it('sem tipo escolhido, oferece os três caracteres', () => {
    comFases(ID_AVALIACAO);
    comUmaEtapa();
    const etapa = cronograma.etapas.at(0);

    edicao.escolherTipoEtapa(etapa, '');
    detectar();

    expect(edicao.caracteresPara(etapa)).toHaveLength(3);
  });
});
