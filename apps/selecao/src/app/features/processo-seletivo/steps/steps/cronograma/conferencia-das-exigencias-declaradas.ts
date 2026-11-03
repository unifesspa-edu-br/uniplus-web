/** O que a conferência precisa saber de uma exigência documental declarada. */
export interface ExigenciaDeclarada {
  readonly nome: string;
  readonly decideResultado: boolean;
  readonly normaResolvida: boolean;
  /** Código da fase em que a exigência foi declarada. */
  readonly faseCodigo: string;
  /** Se essa fase ainda está no cronograma. */
  readonly faseViva: boolean;
  /** Se a exigência alcança ao menos uma modalidade que o quadro de vagas oferta. */
  readonly alcancaModalidade: boolean;
  /** Se pede reenvio numa fase que não admite complementação. */
  readonly reenvioSemComplementacao: boolean;
  /**
   * Se a fase responde mais de um formulário e a exigência ainda não diz em qual o candidato
   * apresenta o documento — o servidor a recusa sem ele.
   */
  readonly semFormulario: boolean;
  /**
   * O que impede o gatilho de ser gravado — fato fora do catálogo, comparação que o domínio
   * não admite, condição sem valor. Vazio quando o gatilho está íntegro, ou quando não há
   * gatilho nenhum.
   */
  readonly problemasDeGatilho: readonly string[];
  /**
   * As condições do gatilho que citam fato ainda não conhecido na fase da exigência, cada uma
   * dita com o que fazer para resolvê-la. Vazio quando todas valem nesta fase.
   */
  readonly problemasDeFase: readonly string[];
}

/**
 * O que impede a exigência de ser gravada: a fase que a ancora saiu do cronograma, ela não
 * alcança modalidade nenhuma, ou pede reenvio onde a fase não admite complementação.
 *
 * Mora aqui, e não na superfície da fase, porque é o passo do Cronograma que grava as
 * exigências e é o `validate()` dele que o wizard chama — a superfície da fase é embutida com
 * `faseFixada` e o `validate()` dela nunca é invocado pela página.
 */
function problemasDeAncoragem(exigencias: readonly ExigenciaDeclarada[]): readonly string[] {
  const problemas: string[] = [];

  const orfas = exigencias.filter((e) => !e.faseViva).map((e) => e.nome);
  if (orfas.length > 0) {
    problemas.push(
      `Há documento exigido numa fase que saiu do cronograma: ${[...new Set(orfas)].join(', ')}. Declare-o em outra fase, ou remova a exigência.`,
    );
  }

  if (exigencias.some((e) => e.faseViva && !e.alcancaModalidade)) {
    problemas.push('Todo documento exigido precisa valer para ao menos uma modalidade aceita.');
  }

  const comGatilhoIncompleto = exigencias.filter(
    (e) => e.faseViva && e.problemasDeGatilho.length > 0,
  );
  for (const exigencia of comGatilhoIncompleto) {
    problemas.push(
      `A condição de "${exigencia.nome}" ainda não está completa: ${exigencia.problemasDeGatilho.join('; ')}.`,
    );
  }

  const semFormulario = exigencias.filter((e) => e.faseViva && e.semFormulario).map((e) => e.nome);
  if (semFormulario.length > 0) {
    problemas.push(
      `Há documento exigido sem o formulário em que o candidato o apresenta: ${[...new Set(semFormulario)].join(', ')}. Na fase dele, escolha o formulário.`,
    );
  }

  for (const exigencia of exigencias.filter((e) => e.faseViva)) {
    for (const problema of exigencia.problemasDeFase) {
      problemas.push(`Na condição de "${exigencia.nome}": ${problema}`);
    }
  }

  const semComplementacao = exigencias
    .filter((e) => e.faseViva && e.reenvioSemComplementacao)
    .map((e) => e.nome);
  if (semComplementacao.length > 0) {
    problemas.push(
      `A consequência "abre pendência para reenvio" só vale em fase que admite complementação, e ${[...new Set(semComplementacao)].join(', ')} está em fase que não admite. Escolha outra consequência, ou declare o documento em outra fase.`,
    );
  }

  return problemas;
}

/**
 * O que a publicação vai cobrar de um GRUPO de exigências, dito como AVISO.
 *
 * Não bloqueia a gravação, e a diferença em relação à exigência individual é o que a torna
 * corrigível: a norma de uma exigência se edita nesta mesma tela, a de um grupo não — o wizard
 * não tem controle que a alcance. Bloquear aqui prenderia quem tem um grupo com norma pendente
 * num passo sem saída, e a única fuga seria remover os documentos do grupo um a um até ele
 * desaparecer, destruindo a configuração.
 *
 * O `PUT` aceita esse estado; quem o recusa é a publicação, e é lá que ele trava.
 */
export function avisosDosGrupos(grupos: readonly GrupoDeclarado[]): readonly string[] {
  return grupos
    .filter((grupo) => grupo.decideResultado && !grupo.normaResolvida)
    .map((grupo) =>
      grupo.documentos.length === 0
        ? 'Um grupo de documentos decide o resultado da análise e ainda não tem norma resolvida. A publicação vai cobrá-la.'
        : `Um grupo de documentos decide o resultado da análise e ainda não tem norma resolvida — o que reúne ${grupo.documentos.join(', ')}. A publicação vai cobrá-la.`,
    );
}

export function problemasDasExigencias(
  exigencias: readonly ExigenciaDeclarada[],
): readonly string[] {
  const problemas: string[] = [...problemasDeAncoragem(exigencias)];

  const semNorma = exigencias.filter((e) => e.decideResultado && !e.normaResolvida);
  if (semNorma.length === 0) return problemas;

  return [
    ...problemas,
    semNorma.length === 1
      ? `A exigência "${semNorma[0].nome}" decide o resultado da análise e precisa da norma que a sustenta.`
      : `${semNorma.length} exigências decidem o resultado da análise e precisam da norma que as sustenta: ${semNorma
          .map((e) => e.nome)
          .join(', ')}.`,
  ];
}

/** O que a conferência precisa saber de um grupo de exigências. */
export interface GrupoDeclarado {
  /** O grupo tem consequência própria — é ele que decide, não cada documento de dentro. */
  readonly decideResultado: boolean;
  readonly normaResolvida: boolean;
  /** Os documentos que ele reúne, para nomear o grupo numa tela que não o edita. */
  readonly documentos: readonly string[];
}
