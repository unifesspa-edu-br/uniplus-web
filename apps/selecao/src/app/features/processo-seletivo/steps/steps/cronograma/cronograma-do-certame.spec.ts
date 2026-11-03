import { describe, expect, it } from 'vitest';
import { CaraterEtapa, UnidadePrazo } from '@uniplus/shared-data/selecao';
import {
  type EtapaPontuada,
  type FaseDoCronograma,
  type RecursoDaEtapa,
} from '../../processo-seletivo.models';
import {
  fracaoDoPercentual,
  percentualDaFracao,
  somaDosItens,
  somaForaDaNotaMaxima,
  textoDaSoma,
} from '../../shared/itens-de-avaliacao';
import { problemasDoCronograma } from './cronograma-do-certame';
import { etapaComOQueDeclara } from './regras-da-etapa';
import {
  SEM_CATALOGO,
  nomeDaBanca,
  tipoQueAdmiteTudo,
  tipoDoEnem,
  problemasDe,
  faseCanonica,
  fase,
  etapa,
  exigenciaDeclarada,
  PRELIMINAR,
} from './cronograma-do-certame.testing';

describe('o que impede gravar o cronograma', () => {
  const AVALIACAO = faseCanonica({
    id: 'id-avaliacao',
    codigo: 'AVALIACAO',
    nome: 'Avaliação',
    agrupaEtapas: true,
    origemData: 'NO_EDITAL',
  });
  const RESULTADO = faseCanonica({
    id: 'id-resultado',
    codigo: 'RESULTADO_PRELIMINAR',
    nome: 'Resultado preliminar',
    origemData: 'NA_EXECUCAO',
  });
  const catalogo = new Map([
    [AVALIACAO.id, AVALIACAO],
    [RESULTADO.id, RESULTADO],
  ]);

  const etapaValida = etapa({
    nome: 'Prova',
    carater: CaraterEtapa.classificatoria,
    tipoEtapaOrigemId: 'tipo-1',
    peso: '1',
  });
  const faseDeAvaliacao = fase({
    faseCanonicaId: AVALIACAO.id,
    codigo: 'AVALIACAO',
    inicio: '2026-03-01T08:00:00-03:00',
    fim: '2026-03-02T18:00:00-03:00',
  });

  it('cronograma sem nenhuma fase é o único problema relatado', () => {
    expect(problemasDe([], [], catalogo, [])).toEqual([
      'O cronograma precisa de ao menos uma fase.',
    ]);
  });

  /**
   * A fase que agrupa etapas é recusada na hora se o processo não tiver etapa
   * alguma. Deixar o operador escolhê-la e descobrir isso na gravação é o
   * estado que este passo existe para evitar.
   */
  it('fase que agrupa etapas sem nenhuma etapa é recusada antes de gravar', () => {
    const problemas = problemasDe([faseDeAvaliacao], [], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('precisa de ao menos uma'));
  });

  /**
   * O caminho oposto só seria recusado na publicação — tarde demais para quem
   * já saiu deste passo.
   */
  it('etapa que não diz a que fase pertence é recusada', () => {
    const semAvaliacao = fase({
      faseCanonicaId: RESULTADO.id,
      codigo: 'RESULTADO_PRELIMINAR',
      produtos: [PRELIMINAR],
    });

    const problemas = problemasDe([semAvaliacao], [etapaValida], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('não dizem a que fase pertencem'));
  });

  it('fase de data definida na execução que coleta inscrição exige a janela', () => {
    const inscricao = faseCanonica({
      id: 'id-inscricao',
      codigo: 'COLETA_INSCRICAO',
      nome: 'Inscrição',
      origemData: 'NA_EXECUCAO',
      coletaInscricao: true,
    });
    const semJanela = fase({ faseCanonicaId: inscricao.id, codigo: 'COLETA_INSCRICAO' });

    const problemas = problemasDe([semJanela], [], new Map([[inscricao.id, inscricao]]), []);

    expect(problemas).toContainEqual('A fase Inscrição precisa de data e hora de início e de fim.');
  });

  it('fase com janela própria exige data e hora de início e de fim', () => {
    const semJanela = fase({ faseCanonicaId: AVALIACAO.id, codigo: 'AVALIACAO' });

    const problemas = problemasDe([semJanela], [etapaValida], catalogo, []);

    expect(problemas).toContainEqual('A fase Avaliação precisa de data e hora de início e de fim.');
  });

  it('fim antes do início é recusado', () => {
    const invertida = fase({
      faseCanonicaId: AVALIACAO.id,
      codigo: 'AVALIACAO',
      inicio: '2026-03-10T08:00:00-03:00',
      fim: '2026-03-01T08:00:00-03:00',
    });

    const problemas = problemasDe([invertida], [etapaValida], catalogo, []);

    expect(problemas).toContainEqual('Na fase Avaliação, o fim não pode vir antes do início.');
  });

  /**
   * Sem nenhuma etapa compondo a nota, o divisor da média seria zero — e a
   * recusa do servidor fala de nota final, não da etapa que ficou sem peso.
   */
  it('etapas que não compõem a nota final são recusadas com a explicação da média', () => {
    const soEliminatoria = etapa({
      nome: 'Títulos',
      carater: CaraterEtapa.eliminatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '',
    });

    const problemas = problemasDe([faseDeAvaliacao], [soEliminatoria], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('compor a nota final'));
  });

  /**
   * O servidor confere o caráter declarado contra o que o tipo admite no cadastro. Sem espelhar
   * isso, a tela deixaria gravar para receber uma recusa que a pessoa não pediu — e o caso
   * acontece sem ninguém errar nada: basta o cadastro estreitar o tipo depois.
   */
  it('caráter que o tipo de etapa não admite é recusado antes de gravar', () => {
    const classificatoria = etapa({
      nome: 'Análise documental',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
    });

    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [classificatoria],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      () => ({
        nome: 'Análise Documental',
        admitePontuacao: false,
        admiteEliminacao: true,
        notaDeOrigemNoEnem: false,
      }),
      [],
    );

    expect(problemas).toContainEqual(expect.stringContaining('não compõe a nota final'));
    expect(problemas).toContainEqual(expect.stringContaining('Análise documental'));
  });

  /** Tipo fora do catálogo carregado não autoriza inventar restrição nenhuma. */
  it('tipo que a tela não conhece não gera recusa de caráter', () => {
    const classificatoria = etapa({
      nome: 'Prova',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
    });

    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [classificatoria],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      () => undefined,
      [],
    );

    expect(problemas).not.toContainEqual(expect.stringContaining('não compõe a nota final'));
  });

  /**
   * A publicação recusa exigência que decide o resultado sem norma resolvida. Descobrir isso
   * só no último passo custa o certame inteiro montado.
   */
  it('exigência que decide o resultado sem norma resolvida é acusada antes de gravar', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ nome: 'Histórico do ensino médio', decideResultado: true })],
    );

    expect(problemas).toContainEqual(expect.stringContaining('Histórico do ensino médio'));
    expect(problemas).toContainEqual(expect.stringContaining('norma'));
  });

  /**
   * A conferência de ancoragem: fase que saiu do cronograma, exigência que não alcança
   * modalidade nenhuma, e reenvio onde a fase não admite complementação. Ela mora aqui porque
   * é o `validate()` do Cronograma que o wizard chama — escrita na superfície da fase, que é
   * embutida com `faseFixada`, a conferência existia e nunca rodava.
   */
  it('acusa a exigência cuja fase saiu do cronograma, nomeando o documento', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ nome: 'Comprovante de renda', faseViva: false })],
    );

    expect(problemas).toContainEqual(expect.stringContaining('saiu do cronograma'));
    expect(problemas).toContainEqual(expect.stringContaining('Comprovante de renda'));
  });

  it('acusa a exigência que não alcança modalidade nenhuma', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ alcancaModalidade: false })],
    );

    expect(problemas).toContainEqual(expect.stringContaining('modalidade'));
  });

  /** Exigência já acusada de órfã não é acusada de novo por não alcançar modalidade. */
  it('não repete a queixa de modalidade sobre exigência de fase morta', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ faseViva: false, alcancaModalidade: false })],
    );

    expect(problemas).not.toContainEqual(expect.stringContaining('modalidade'));
  });

  it('acusa a exigência sem o formulário em que o documento é apresentado, nomeando o documento', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ nome: 'Comprovante de renda', semFormulario: true })],
    );

    expect(problemas).toContainEqual(
      'Há documento exigido sem o formulário em que o candidato o apresenta: Comprovante de renda. Na fase dele, escolha o formulário.',
    );
  });

  it('acusa o reenvio declarado em fase que não admite complementação', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ nome: 'Contracheque', reenvioSemComplementacao: true })],
    );

    expect(problemas).toContainEqual(expect.stringContaining('complementação'));
    expect(problemas).toContainEqual(expect.stringContaining('Contracheque'));
  });

  it('acusa a condição que cita dado ainda não conhecido na fase, com o que fazer', () => {
    const orientacao =
      '“Laudo” só é conhecido na fase Habilitação. Como resolver: exija o documento na fase Habilitação.';
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ nome: 'Laudo médico', problemasDeFase: [orientacao] })],
    );

    expect(problemas).toContain(`Na condição de "Laudo médico": ${orientacao}`);
  });

  /** Controle negativo: exigência conforme não produz nenhuma das três queixas. */
  it('exigência ancorada, com modalidade e sem reenvio indevido não é acusada', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ normaResolvida: true })],
    );

    expect(problemas).not.toContainEqual(expect.stringContaining('saiu do cronograma'));
    expect(problemas).not.toContainEqual(expect.stringContaining('modalidade'));
    expect(problemas).not.toContainEqual(expect.stringContaining('complementação'));
  });

  it('exigência que não decide o resultado segue sem norma', () => {
    const problemas = problemasDoCronograma(
      [faseDeAvaliacao],
      [],
      catalogo,
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoQueAdmiteTudo,
      [exigenciaDeclarada({ nome: 'Foto 3x4', decideResultado: false })],
    );

    expect(problemas).not.toContainEqual(expect.stringContaining('norma'));
  });

  it('mesma posição em duas fases é recusada', () => {
    const outra = fase({
      faseCanonicaId: RESULTADO.id,
      codigo: 'RESULTADO_PRELIMINAR',
      ordem: 1,
      produtos: [PRELIMINAR],
    });

    const problemas = problemasDe([faseDeAvaliacao, outra], [etapaValida], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('mesma posição na linha do tempo'));
  });

  /**
   * Texto que não converte vira `null` no comando, e `null` é o valor legítimo
   * de "não declarado": sem conferir, o campo malformado grava com sucesso e
   * apaga o que estava lá, sem nada dizer.
   */
  it('número malformado é recusado em vez de limpar o campo em silêncio', () => {
    const notaTorta = etapa({
      nome: 'Prova',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
      notaMinima: '7,5,',
    });

    const problemas = problemasDe([faseDeAvaliacao], [notaTorta], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('nota mínima'));
  });

  it('recusa nota máxima que não é número ou que não passa de zero', () => {
    const base = { nome: 'Prova', peso: '1', tipoEtapaOrigemId: 'tipo-1' };

    expect(
      problemasDe([faseDeAvaliacao], [etapa({ ...base, notaMaxima: '10,' })], catalogo, []),
    ).toContainEqual(expect.stringContaining('nota máxima'));
    expect(
      problemasDe([faseDeAvaliacao], [etapa({ ...base, notaMaxima: '0' })], catalogo, []),
    ).toContainEqual(expect.stringContaining('nota máxima'));
    expect(
      problemasDe([faseDeAvaliacao], [etapa({ ...base, notaMaxima: '' })], catalogo, []),
    ).not.toContainEqual(expect.stringContaining('nota máxima'));
  });

  it('recusa localmente a nota mínima acima da nota máxima', () => {
    const base = { nome: 'Prova', peso: '1', tipoEtapaOrigemId: 'tipo-1', notaMaxima: '10' };
    const confere = (notaMinima: string) =>
      problemasDe([faseDeAvaliacao], [etapa({ ...base, notaMinima })], catalogo, []);

    expect(confere('12')).toContainEqual(expect.stringContaining('não pode passar'));
    expect(confere('10')).not.toContainEqual(expect.stringContaining('não pode passar'));
  });

  it('recusa o passo do lançamento que não é número ou não passa de zero', () => {
    const base = {
      nome: 'Prova',
      peso: '1',
      tipoEtapaOrigemId: 'tipo-1',
      formaDeAvaliacao: 'HUMANA',
    };
    const confere = (passoDoLancamento: string) =>
      problemasDe([faseDeAvaliacao], [etapa({ ...base, passoDoLancamento })], catalogo, []);

    expect(confere('0,')).toContainEqual(expect.stringContaining('passo do lançamento'));
    expect(confere('0')).toContainEqual(expect.stringContaining('passo do lançamento'));
    expect(confere('')).not.toContainEqual(expect.stringContaining('passo do lançamento'));
    expect(confere('0,25')).not.toContainEqual(expect.stringContaining('passo do lançamento'));
  });

  describe('itens de avaliação e escala de atendimento', () => {
    const item = (rotulo: string, pontuacaoMaxima: string) => ({
      id: null,
      rotulo,
      pontuacaoMaxima,
    });
    const escala = [
      { rotulo: 'Atendeu', percentual: '100' },
      { rotulo: 'Não atendeu', percentual: '0' },
    ];
    const humanaComItens = etapa({
      nome: 'Projeto',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      notaMaxima: '10',
      formaDeAvaliacao: 'HUMANA',
      itensDeAvaliacao: [item('Clareza', '4'), item('Método', '6')],
      escalaDeAtendimento: escala,
    });

    it('com escala o passo sai e a escala segue', () => {
      expect(
        etapaComOQueDeclara({ ...humanaComItens, passoDoLancamento: '0,5' }, undefined),
      ).toMatchObject({ passoDoLancamento: '', escalaDeAtendimento: escala });
    });

    it('descarta a escala fora da forma humana ou sem itens, e mantém os itens', () => {
      expect(
        etapaComOQueDeclara({ ...humanaComItens, formaDeAvaliacao: 'OBJETIVA' }, undefined),
      ).toMatchObject({
        escalaDeAtendimento: [],
        itensDeAvaliacao: humanaComItens.itensDeAvaliacao,
      });
      expect(
        etapaComOQueDeclara({ ...humanaComItens, itensDeAvaliacao: [] }, undefined),
      ).toMatchObject({ escalaDeAtendimento: [] });
    });

    it('descarta itens e escala da etapa sem nota', () => {
      expect(etapaComOQueDeclara({ ...humanaComItens, carater: '' }, undefined)).toMatchObject({
        itensDeAvaliacao: [],
        escalaDeAtendimento: [],
      });
    });

    it('recusa a pontuação do item e o percentual do nível que não são número', () => {
      const confere = (parcial: Partial<EtapaPontuada>) =>
        problemasDe([faseDeAvaliacao], [etapa({ ...humanaComItens, ...parcial })], catalogo, []);

      expect(confere({ itensDeAvaliacao: [item('A', '4,')] })).toContainEqual(
        expect.stringContaining('pontuação máxima de cada item'),
      );
      expect(confere({ itensDeAvaliacao: [item('A', '')] })).toContainEqual(
        expect.stringContaining('pontuação máxima de cada item'),
      );
      expect(
        confere({ escalaDeAtendimento: [{ rotulo: 'A', percentual: 'meio' }] }),
      ).toContainEqual(expect.stringContaining('percentual de cada nível'));
      expect(confere({})).not.toContainEqual(expect.stringContaining('de cada'));
    });

    it('a soma dos itens usa as quatro casas do servidor e não acusa erro de ponto flutuante', () => {
      expect(somaDosItens([item('A', '0,1'), item('B', '0.2')])).toBe(0.3);
      expect(somaForaDaNotaMaxima([item('A', '0,1'), item('B', '0.2')], '0,3')).toBe(false);
      expect(somaForaDaNotaMaxima([item('A', '4')], '10')).toBe(true);
      expect(somaForaDaNotaMaxima([], '10')).toBe(false);
      expect(textoDaSoma([item('A', '4'), item('B', '4')], '10')).toBe('Soma dos itens: 8 de 10');
      expect(textoDaSoma([item('A', '10,0004')], '10')).toBe('Soma dos itens: 10,0004 de 10');
    });

    it('o percentual vira fração e volta sem sujeira', () => {
      expect(fracaoDoPercentual('50')).toBe(0.5);
      expect(fracaoDoPercentual('33,33')).toBe(0.3333);
      expect(fracaoDoPercentual('meio')).toBeNull();
      expect(percentualDaFracao(0.3333)).toBe('33.33');
      expect(percentualDaFracao(1)).toBe('100');
    });
  });

  it('não confere a nota máxima herdada por etapa do ENEM nem a mostra como pendência', () => {
    const doEnem = etapa({
      nome: 'Nota do ENEM',
      peso: '1',
      notaMaxima: '0',
      notaMinima: '5',
      tipoCongelado: { origemId: 'tipo-1', notaDeOrigemNoEnem: true },
    });

    const problemas = problemasDe([faseDeAvaliacao], [doEnem], catalogo, []);

    expect(problemas).not.toContainEqual(expect.stringContaining('nota máxima'));
    expect(problemas).not.toContainEqual(expect.stringContaining('não pode passar'));
  });

  it('campo numérico vazio continua sendo não declarado, e não erro', () => {
    const semNota = etapa({
      nome: 'Prova',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
      notaMinima: '',
    });

    expect(problemasDe([faseDeAvaliacao], [semNota], catalogo, [])).toEqual([]);
  });

  /**
   * Zero converte, então nem a conferência de forma nem a agregada o pegam: com
   * outra etapa compondo a nota, a gravação sairia para o domínio recusar por
   * causa da que ficou zerada.
   */
  it('peso zero declarado é recusado mesmo com outra etapa compondo a nota', () => {
    const compoe = etapa({
      nome: 'Prova',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
      ordem: 1,
    });
    const zerada = etapa({
      nome: 'Redação',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '0',
      ordem: 2,
    });

    const problemas = problemasDe([faseDeAvaliacao], [compoe, zerada], catalogo, []);

    expect(problemas).toContainEqual(expect.stringContaining('maior que zero'));
  });

  it('etapa sem peso declarado continua válida ao lado de outra que compõe', () => {
    const compoe = etapa({
      nome: 'Prova',
      carater: CaraterEtapa.classificatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '1',
      ordem: 1,
    });
    const soEliminatoria = etapa({
      nome: 'Títulos',
      carater: CaraterEtapa.eliminatoria,
      tipoEtapaOrigemId: 'tipo-1',
      peso: '',
      ordem: 2,
    });

    expect(problemasDe([faseDeAvaliacao], [compoe, soEliminatoria], catalogo, [])).toEqual([]);
  });

  it('cronograma coerente não relata problema', () => {
    expect(problemasDe([faseDeAvaliacao], [etapaValida], catalogo, [])).toEqual([]);
  });

  /**
   * A âncora não é editada neste passo, mas atravessa o formulário até a
   * gravação. Sem cobrá-la aqui, mexer numa data enviaria o cronograma inteiro
   * para ser recusado por um campo que a tela nem mostra.
   */
  it('cobra a publicação que ancora o prazo antes de deixar gravar', () => {
    const semAncora = fase({
      faseCanonicaId: RESULTADO.id,
      codigo: 'RESULTADO_PRELIMINAR',
      produtos: [PRELIMINAR],
      regraRecurso: {
        regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
        regraVersao: 'v1',
        prazoValor: '2',
        prazoUnidade: UnidadePrazo.diasUteis,
        atoAncoraCodigo: '',
        suspensividadePrimeiraInstanciaValor: '',
        suspensividadePrimeiraInstanciaUnidade: '',
        admiteInstanciaSuperior: true,
        suspensividadeSegundaInstanciaValor: '',
        suspensividadeSegundaInstanciaUnidade: '',
      },
    });

    const problemas = problemasDe([faseDeAvaliacao, semAncora], [etapaValida], catalogo, []);

    expect(problemas).toContain(
      'Na fase Resultado preliminar: Escolha a publicação preliminar de cuja divulgação corre o prazo de recurso. Corrija em Configuração por fase.',
    );
  });

  /**
   * A janela recursal da etapa. O prazo é obrigatório no comando e o mapeador converte o que
   * não casa para 0 — janela de prazo zero fecha no instante em que abre, e o servidor aceita.
   */
  describe('janela de recurso da etapa', () => {
    function comRecurso(patch: Partial<RecursoDaEtapa>): readonly string[] {
      return problemasDoCronograma(
        [faseDeAvaliacao],
        [
          etapa({
            nome: 'Prova Objetiva',
            faseCodigo: 'AVALIACAO',
            recursos: [
              {
                ancora: 'atoPublicado',
                regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
                regraVersao: '1.0.0',
                prazoValor: '2',
                prazoUnidade: 'diasUteis',
                atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
                suspensividadePrimeiraInstanciaValor: '',
                suspensividadePrimeiraInstanciaUnidade: '',
                admiteInstanciaSuperior: true,
                suspensividadeSegundaInstanciaValor: '',
                suspensividadeSegundaInstanciaUnidade: '',
                ...patch,
              },
            ],
          }),
        ],
        catalogo,
        [],
        SEM_CATALOGO,
        nomeDaBanca,
        tipoQueAdmiteTudo,
        [],
      );
    }

    /**
     * A janela ancorada em ato corre da publicação preliminar DA PRÓPRIA etapa, e os produtos
     * mudam por outro caminho: retirar o preliminar deixava a janela apontando para o que não
     * existe mais. A gravação seguia, e o servidor recusava a etapa inteira sem dizer que o
     * problema era a âncora — nem em qual etapa.
     */
    it('acusa a janela que corre de uma publicação que a etapa não declara mais', () => {
      expect(comRecurso({})).toContainEqual(
        expect.stringContaining('resultado preliminar que a etapa não declara mais'),
      );
    });

    it('não acusa quando a etapa declara a publicação de que a janela corre', () => {
      const problemas = problemasDoCronograma(
        [faseDeAvaliacao],
        [
          etapa({
            nome: 'Prova Objetiva',
            faseCodigo: 'AVALIACAO',
            produtos: [PRELIMINAR],
            recursos: [
              {
                ancora: 'atoPublicado',
                regraCodigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO',
                regraVersao: '1.0.0',
                prazoValor: '2',
                prazoUnidade: 'diasUteis',
                atoAncoraCodigo: 'RESULTADO_PRELIMINAR',
                suspensividadePrimeiraInstanciaValor: '',
                suspensividadePrimeiraInstanciaUnidade: '',
                admiteInstanciaSuperior: true,
                suspensividadeSegundaInstanciaValor: '',
                suspensividadeSegundaInstanciaUnidade: '',
              },
            ],
          }),
        ],
        catalogo,
        [],
        SEM_CATALOGO,
        nomeDaBanca,
        tipoQueAdmiteTudo,
        [],
      );

      expect(problemas).not.toContainEqual(
        expect.stringContaining('resultado preliminar que a etapa não declara mais'),
      );
    });

    it('acusa prazo em branco', () => {
      expect(comRecurso({ prazoValor: '' })).toContainEqual(
        expect.stringContaining('prazo maior que zero'),
      );
    });

    it('acusa prazo que a gramática numérica não aceita', () => {
      expect(comRecurso({ prazoValor: '2,5 dias' })).toContainEqual(
        expect.stringContaining('prazo maior que zero'),
      );
    });

    it('acusa prazo zero declarado', () => {
      expect(comRecurso({ prazoValor: '0' })).toContainEqual(
        expect.stringContaining('prazo maior que zero'),
      );
    });

    it('não acusa prazo válido', () => {
      expect(comRecurso({})).not.toContainEqual(expect.stringContaining('prazo maior que zero'));
    });

    /**
     * As duas conferências que só a fase tinha. O prazo e a suspensividade vivem no MESMO value
     * object nos dois donos, e o servidor passou a prová-las nos dois — a tela que aprovasse
     * aqui mandaria o operador colher um 422 que a fase nunca deixaria acontecer.
     */
    it('acusa fração de dia útil no prazo', () => {
      expect(comRecurso({ prazoValor: '2.5', prazoUnidade: 'diasUteis' })).toContainEqual(
        expect.stringContaining('fração de dia útil'),
      );
    });

    it('não acusa dia útil inteiro', () => {
      expect(comRecurso({ prazoValor: '2', prazoUnidade: 'diasUteis' })).not.toContainEqual(
        expect.stringContaining('fração de dia útil'),
      );
    });

    it('acusa suspensividade com valor e sem unidade', () => {
      expect(comRecurso({ suspensividadePrimeiraInstanciaValor: '3' })).toContainEqual(
        expect.stringContaining('suspensividade'),
      );
    });

    it('cobra a resposta sobre a instância superior da janela', () => {
      expect(comRecurso({ admiteInstanciaSuperior: null })).toContainEqual(
        expect.stringContaining('instância superior'),
      );
    });

    it('não confere o tempo de bloqueio superior da janela que não admite a instância', () => {
      expect(
        comRecurso({
          admiteInstanciaSuperior: false,
          suspensividadeSegundaInstanciaUnidade: UnidadePrazo.horas,
        }),
      ).not.toContainEqual(expect.stringContaining('suspensividade'));
    });

    it('acusa suspensividade com unidade e sem valor', () => {
      expect(
        comRecurso({ suspensividadeSegundaInstanciaUnidade: UnidadePrazo.horas }),
      ).toContainEqual(expect.stringContaining('suspensividade'));
    });

    it('acusa suspensividade não positiva', () => {
      expect(
        comRecurso({
          suspensividadePrimeiraInstanciaValor: '0',
          suspensividadePrimeiraInstanciaUnidade: UnidadePrazo.diasUteis,
        }),
      ).toContainEqual(expect.stringContaining('suspensividade'));
    });

    it('aceita o par completo, e aceita a instância desativada', () => {
      const comPar = comRecurso({
        suspensividadePrimeiraInstanciaValor: '3',
        suspensividadePrimeiraInstanciaUnidade: UnidadePrazo.diasUteis,
      });
      expect(comPar).not.toContainEqual(expect.stringContaining('suspensividade'));
      expect(comRecurso({})).not.toContainEqual(expect.stringContaining('suspensividade'));
    });

    /** Janela sem regra resolvida é descartada na gravação — e isso precisa ser dito. */
    it('acusa a janela cuja regra o catálogo ainda não resolveu', () => {
      expect(comRecurso({ regraCodigo: '', regraVersao: '' })).toContainEqual(
        expect.stringContaining('sem a regra de prazo'),
      );
    });
  });
});

describe('a janela própria da etapa', () => {
  const CATALOGO = new Map([
    [
      'id-aval',
      faseCanonica({ id: 'id-aval', codigo: 'AVALIACAO', nome: 'Avaliação', agrupaEtapas: true }),
    ],
  ]);

  /** Fase de 10 a 20 de março, a janela contra a qual a etapa é conferida. */
  const avaliacao = fase({
    faseCanonicaId: 'id-aval',
    codigo: 'AVALIACAO',
    inicio: '2027-03-10T08:00',
    fim: '2027-03-20T18:00',
  });

  const naAvaliacao = (inicio: string, fim: string, nome = 'Prova') =>
    etapa({ nome, faseCodigo: 'AVALIACAO', inicio, fim });

  const conferir = (e: EtapaPontuada, f: FaseDoCronograma = avaliacao) =>
    problemasDe([f], [e], CATALOGO, []);

  it('aceita a etapa inteiramente dentro da fase', () => {
    const problemas = conferir(naAvaliacao('2027-03-12T09:00', '2027-03-14T17:00'));

    expect(problemas.filter((p) => p.includes('Prova'))).toEqual([]);
  });

  /** Refinar não obriga a encolher: a etapa pode ocupar a fase inteira. */
  it('aceita a etapa que coincide com as bordas da fase', () => {
    const problemas = conferir(naAvaliacao('2027-03-10T08:00', '2027-03-20T18:00'));

    expect(problemas.filter((p) => p.includes('Prova'))).toEqual([]);
  });

  it('acusa a etapa cujo fim vem antes do próprio início', () => {
    const problemas = conferir(naAvaliacao('2027-03-14T17:00', '2027-03-12T09:00'));

    expect(problemas).toContain('Na etapa "Prova", o fim não pode vir antes do início.');
  });

  /** Com a janela invertida, comparar com a fase só somaria ruído ao mesmo defeito. */
  it('não soma a queixa de contenção quando a própria janela está invertida', () => {
    const problemas = conferir(naAvaliacao('2027-03-30T17:00', '2027-03-01T09:00'));

    expect(problemas.filter((p) => p.includes('Prova'))).toHaveLength(1);
  });

  it('acusa a etapa que começa antes da fase', () => {
    const problemas = conferir(naAvaliacao('2027-03-09T08:00', '2027-03-14T17:00'));

    expect(problemas).toContain(
      'A etapa "Prova" começa antes da fase Avaliação. A janela da etapa precisa caber na da fase.',
    );
  });

  it('acusa a etapa que termina depois da fase', () => {
    const problemas = conferir(naAvaliacao('2027-03-12T09:00', '2027-03-21T09:00'));

    expect(problemas).toContain(
      'A etapa "Prova" termina depois da fase Avaliação. A janela da etapa precisa caber na da fase.',
    );
  });

  it('acusa as duas pontas quando a etapa transborda dos dois lados', () => {
    const problemas = conferir(naAvaliacao('2027-03-09T08:00', '2027-03-21T09:00'));

    expect(problemas.filter((p) => p.includes('Prova'))).toHaveLength(2);
  });

  /** Em branco, a etapa acontece na janela da fase — é o que a dica do campo promete. */
  it('não confere nada quando a etapa não declara janela', () => {
    const problemas = conferir(naAvaliacao('', ''));

    expect(problemas.filter((p) => p.includes('Prova'))).toEqual([]);
  });

  it('confere a ponta declarada quando só uma das duas datas existe', () => {
    expect(conferir(naAvaliacao('2027-03-09T08:00', ''))).toContain(
      'A etapa "Prova" começa antes da fase Avaliação. A janela da etapa precisa caber na da fase.',
    );
    expect(conferir(naAvaliacao('', '2027-03-21T09:00'))).toContain(
      'A etapa "Prova" termina depois da fase Avaliação. A janela da etapa precisa caber na da fase.',
    );
  });

  /**
   * Fase sem janela não tem o que conter, e exigir data dela por causa da etapa inventaria uma
   * obrigação que o cadastro não faz. A coerência interna da etapa continua valendo.
   */
  it('tolera a etapa com janela própria quando a fase não declara a dela', () => {
    const semJanela = fase({
      faseCanonicaId: 'id-aval',
      codigo: 'AVALIACAO',
      inicio: null,
      fim: null,
    });

    const problemas = conferir(naAvaliacao('2027-03-12T09:00', '2027-03-14T17:00'), semJanela);

    expect(problemas.filter((p) => p.includes('Prova'))).toEqual([]);
  });

  it('nomeia a etapa sem nome em vez de deixar a mensagem sem sujeito', () => {
    const problemas = conferir(naAvaliacao('2027-03-09T08:00', '2027-03-14T17:00', ''));

    expect(problemas).toContain(
      'A etapa sem nome começa antes da fase Avaliação. A janela da etapa precisa caber na da fase.',
    );
  });
});

describe('etapa de nota do ENEM', () => {
  const faseDeAvaliacao = fase({ faseCanonicaId: 'fase-1', codigo: 'AVALIACAO' });

  function problemasDaEnem(parcial: Partial<EtapaPontuada>): readonly string[] {
    return problemasDoCronograma(
      [faseDeAvaliacao],
      [etapa({ nome: 'Nota do ENEM', ...parcial })],
      new Map([['fase-1', faseCanonica({ id: 'fase-1', codigo: 'AVALIACAO' })]]),
      [],
      SEM_CATALOGO,
      nomeDaBanca,
      tipoDoEnem,
      [],
    ).filter((problema) => problema.includes('nota do ENEM'));
  }

  it('classificatória com peso não tem pendência', () => {
    expect(problemasDaEnem({ carater: CaraterEtapa.classificatoria, peso: '2' })).toEqual([]);
  });

  it('puramente eliminatória é recusada: a etapa sempre compõe a média', () => {
    expect(problemasDaEnem({ carater: CaraterEtapa.eliminatoria, peso: '' })).toHaveLength(1);
  });

  it('com banca, publicação, janela própria ou recurso contado de publicação é recusada', () => {
    const recurso = (ancora: RecursoDaEtapa['ancora']): RecursoDaEtapa => ({
      ancora,
      regraCodigo: 'R',
      regraVersao: 'v1',
      prazoValor: '2',
      prazoUnidade: 'diasUteis',
      atoAncoraCodigo: '',
      suspensividadePrimeiraInstanciaValor: '',
      suspensividadePrimeiraInstanciaUnidade: '',
      admiteInstanciaSuperior: true,
      suspensividadeSegundaInstanciaValor: '',
      suspensividadeSegundaInstanciaUnidade: '',
    });
    expect(problemasDaEnem({ bancas: ['banca-1'] })).toHaveLength(1);
    expect(problemasDaEnem({ inicio: '2027-01-10T08:00' })).toHaveLength(1);
    expect(problemasDaEnem({ fim: '2027-01-10T18:00' })).toHaveLength(1);
    expect(problemasDaEnem({ produtos: [{ atoCodigo: 'ATO', papel: null }] })).toHaveLength(1);
    expect(problemasDaEnem({ recursos: [recurso('atoPublicado')] })).toHaveLength(1);
    expect(problemasDaEnem({ recursos: [recurso('cienciaIndividual')] })).toEqual([]);
  });
});
