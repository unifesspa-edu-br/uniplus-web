import { describe, expect, it } from 'vitest';
import { UnidadePrazo } from '@uniplus/shared-data/selecao';
import { type EtapaPontuada, type FaseDoCronograma } from '../../processo-seletivo.models';
import {
  problemasDe,
  faseCanonica,
  fase,
  etapa,
  PRELIMINAR,
  AVALIACAO,
  RESULTADO,
  catalogoDeFases,
  etapaValida,
  faseDeAvaliacao,
} from './cronograma-do-certame.testing';

describe('o que impede gravar o cronograma', () => {
  it('cronograma sem nenhuma fase é o único problema relatado', () => {
    expect(problemasDe([], [], catalogoDeFases, [])).toEqual([
      'O cronograma precisa de ao menos uma fase.',
    ]);
  });

  /**
   * A fase que agrupa etapas é recusada na hora se o processo não tiver etapa
   * alguma. Deixar o operador escolhê-la e descobrir isso na gravação é o
   * estado que este passo existe para evitar.
   */

  /**
   * O caminho oposto só seria recusado na publicação — tarde demais para quem
   * já saiu deste passo.
   */

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

    const problemas = problemasDe([semJanela], [etapaValida], catalogoDeFases, []);

    expect(problemas).toContainEqual('A fase Avaliação precisa de data e hora de início e de fim.');
  });

  it('fim antes do início é recusado', () => {
    const invertida = fase({
      faseCanonicaId: AVALIACAO.id,
      codigo: 'AVALIACAO',
      inicio: '2026-03-10T08:00:00-03:00',
      fim: '2026-03-01T08:00:00-03:00',
    });

    const problemas = problemasDe([invertida], [etapaValida], catalogoDeFases, []);

    expect(problemas).toContainEqual('Na fase Avaliação, o fim não pode vir antes do início.');
  });

  /**
   * Sem nenhuma etapa compondo a nota, o divisor da média seria zero — e a
   * recusa do servidor fala de nota final, não da etapa que ficou sem peso.
   */

  /**
   * O servidor confere o caráter declarado contra o que o tipo admite no cadastro. Sem espelhar
   * isso, a tela deixaria gravar para receber uma recusa que a pessoa não pediu — e o caso
   * acontece sem ninguém errar nada: basta o cadastro estreitar o tipo depois.
   */

  /**
   * A publicação recusa exigência que decide o resultado sem norma resolvida. Descobrir isso
   * só no último passo custa o certame inteiro montado.
   */

  /**
   * A conferência de ancoragem: fase que saiu do cronograma, exigência que não alcança
   * modalidade nenhuma, e reenvio onde a fase não admite complementação. Ela mora aqui porque
   * é o `validate()` do Cronograma que o wizard chama — escrita na superfície da fase, que é
   * embutida com `faseFixada`, a conferência existia e nunca rodava.
   */

  /**
   * Texto que não converte vira `null` no comando, e `null` é o valor legítimo
   * de "não declarado": sem conferir, o campo malformado grava com sucesso e
   * apaga o que estava lá, sem nada dizer.
   */

  /**
   * Zero converte, então nem a conferência de forma nem a agregada o pegam: com
   * outra etapa compondo a nota, a gravação sairia para o domínio recusar por
   * causa da que ficou zerada.
   */

  it('cronograma coerente não relata problema', () => {
    expect(problemasDe([faseDeAvaliacao], [etapaValida], catalogoDeFases, [])).toEqual([]);
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

    const problemas = problemasDe([faseDeAvaliacao, semAncora], [etapaValida], catalogoDeFases, []);

    expect(problemas).toContain(
      'Na fase Resultado preliminar: Escolha a publicação preliminar de cuja divulgação corre o prazo de recurso. Corrija em Configuração por fase.',
    );
  });

  /**
   * A janela recursal da etapa. O prazo é obrigatório no comando e o mapeador converte o que
   * não casa para 0 — janela de prazo zero fecha no instante em que abre, e o servidor aceita.
   */
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
