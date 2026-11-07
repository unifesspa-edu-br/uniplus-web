import type { ConducaoDoWizard } from './conducao-do-wizard.service';
import { falhaAoConcluir, mensagensDe } from './mensagens-do-passo';

const DESEMPATE_AINDA_PENDENTE =
  'Os critérios de desempate por área não foram gravados, porque a classificação não ficou gravada com o quadro de Peso por Área de que eles dependem. Grave a classificação no passo Eliminação, com a resolução escolhida no passo Fórmula, e publique de novo.';

/**
 * Publica só com o rascunho inteiro válido. Como a navegação entre passos é livre, chegar ao
 * último passo não significa ter preenchido os anteriores: sem esta checagem dá para saltar direto
 * para a revisão e publicar um rascunho vazio, ou invalidar um passo já concluído e voltar para cá.
 *
 * Duas passadas de `validarRascunho()`, e a ordem não é a intuitiva. A primeira cobre só os passos
 * ANTERIORES à Revisão: é rápida, sem rede, e barra de imediato um passo incompleto. A Revisão
 * fica de fora dela porque o `validar()` dela recusaria com o checklist ainda velho sempre que o
 * operador tivesse corrigido um passo e voltado direto à Revisão pelo stepper livre, antes de
 * `gravarPassosAnteriores()` gravar a correção. Só depois de gravar de novo e recarregar o
 * checklist a segunda passada, com a Revisão incluída, vê o que a primeira acabou de produzir.
 *
 * `geracao` é conferida depois de cada await: o operador pode trocar de processo no meio da
 * varredura, e continuar dali gravaria no rascunho do processo NOVO. Sai calada quando isso acontece.
 */
export async function publicar(conducao: ConducaoDoWizard): Promise<void> {
  const { store } = conducao;
  const geracao = store.geracao();

  // `travamentoDeOrquestracao`, não só o `salvando()` de cada passo: cada `persistir()` solta o
  // seu `salvando` ao terminar, mas a orquestração inteira (gravar, recarregar o checklist,
  // validar de novo) ainda não acabou, e o intervalo entre um passo e outro liberava o stepper e
  // os campos. Liga antes de qualquer espera e solta ao sair, inclusive ao abrir o diálogo de
  // confirmação, cuja modalidade passa a impedir a edição por baixo.
  store.travamentoDeOrquestracao.set(true);
  try {
    if (!(await passosAnterioresCompletos(conducao, geracao))) return;
    if (!(await passosAnterioresGravados(conducao, geracao))) return;
    if (!(await rascunhoInteiroValido(conducao, geracao))) return;

    store.definirErroDoPasso(null);
    const validator = conducao.passoNo(store.passoAtual());
    const confirmacao = validator?.confirmacaoDeGravacao?.();
    if (confirmacao) {
      conducao.pedirConfirmacao(confirmacao);
      return;
    }

    await conducao.gravarEAvancar(validator);
  } finally {
    if (geracao === store.geracao()) store.travamentoDeOrquestracao.set(false);
  }
}

/** Mostra as pendências e barra a publicação; `false` quando não há pendência. */
function barradaPelasPendencias(conducao: ConducaoDoWizard, pendencias: string[]): boolean {
  if (pendencias.length === 0) return false;
  conducao.store.definirErroDoPasso(pendencias);
  conducao.revelarErro();
  return true;
}

/** Primeira passada: só os passos anteriores à Revisão, sem rede; `false` barra a publicação. */
async function passosAnterioresCompletos(
  conducao: ConducaoDoWizard,
  geracao: number,
): Promise<boolean> {
  const { store } = conducao;
  let pendentes = conducao.validarRascunho(store.totalDePassos - 1);
  // O Desempate recusa o critério por área enquanto não se sabe o que a classificação gravada
  // tem. Com algo por reler, a recusa pode ser essa: a releitura decide e a validação se refaz.
  // Sem nada por reler, o rascunho incompleto é barrado sem ir à rede.
  if (pendentes.length > 0 && store.classificacao.gravadoPorReler()) {
    await conducao.reler();
    if (geracao !== store.geracao()) return false;
    pendentes = conducao.validarRascunho(store.totalDePassos - 1);
  }
  return !barradaPelasPendencias(conducao, pendentes);
}

/** Grava os passos anteriores e põe o processo em dia; `false` barra a publicação. */
async function passosAnterioresGravados(
  conducao: ConducaoDoWizard,
  geracao: number,
): Promise<boolean> {
  const { store } = conducao;
  const falhas = await gravarPassosAnteriores(conducao);
  if (geracao !== store.geracao()) return false;
  // Os passos gravados na varredura não releem o detalhe um a um; uma leitura só, aqui, põe em
  // dia o que o processo congelou, com ou sem falha na varredura, e confirma a cópia que a
  // gravação da classificação presumiu.
  if (store.classificacao.gravadoPorReler()) await conducao.reler();
  if (geracao !== store.geracao()) return false;
  if (falhas.length === 0) acrescentarDesempateAindaPendente(conducao, falhas);
  return !barradaPelasPendencias(conducao, falhas);
}

/** Critérios que ainda esperam a classificação não podem ficar para trás: publicar seguiria com os que o servidor tinha antes. */
function acrescentarDesempateAindaPendente(conducao: ConducaoDoWizard, falhas: string[]): void {
  const indiceDoDesempate = conducao.indiceDoPassoPosClassificacao();
  if (conducao.store.classificacao.desempatePendenteDeGravacao() && indiceDoDesempate >= 0) {
    falhas.push(conducao.pendenciaDoPasso(indiceDoDesempate, [DESEMPATE_AINDA_PENDENTE]));
  }
}

/** Segunda passada, com a Revisão incluída; `false` barra a publicação. */
async function rascunhoInteiroValido(
  conducao: ConducaoDoWizard,
  geracao: number,
): Promise<boolean> {
  const { store } = conducao;
  // A Revisão fica de fora da varredura, porque o `persistir()` dela publica de verdade, mas o
  // checklist que ela cacheia pode ter ficado desatualizado exatamente pelos passos gravados.
  await conducao.passoNo(store.totalDePassos - 1)?.recarregarChecklist?.();
  if (geracao !== store.geracao()) return false;
  return !barradaPelasPendencias(conducao, conducao.validarRascunho());
}

/**
 * Grava de novo cada passo anterior à Revisão que declara `persistir()`, não só valida. A
 * navegação é livre: o operador pode voltar a um passo já gravado, editá-lo e pular direto para a
 * Revisão sem passar pelo avanço que grava. `validarRascunho()` só confere o rascunho local, não
 * que ele bate com o servidor, e sem esta varredura a publicação confirmava sobre uma edição que
 * nunca chegou lá.
 *
 * Detectar o passo "sujo" exigiria um mapeamento de passo para seção do `WizardDraft` que o wizard
 * não tem de propósito, e o rascunho tem mais de um caminho de escrita. Um retrato comparado após
 * a hidratação já quebrou toda retomada com edital confirmado, porque a restauração do anexo muda
 * o rascunho depois dele. Gravar de novo custa uma chamada a mais por passo, mas é correto por
 * construção: o `persistir()` de cada passo já é reenvio idempotente.
 */
async function gravarPassosAnteriores(conducao: ConducaoDoWizard): Promise<string[]> {
  const { store } = conducao;
  const pendencias: string[] = [];
  const geracao = store.geracao();

  for (let index = 0; index < store.totalDePassos - 1; index += 1) {
    pendencias.push(...(await gravarPasso(conducao, index)));
    // O operador pode ter navegado para outro processo com a varredura ainda correndo: continuar
    // chamaria `persistir()` dos passos seguintes contra o rascunho do processo NOVO. Sai calada,
    // e `publicar()` confere a geração de novo ao voltar.
    if (geracao !== store.geracao()) return [];
  }

  return pendencias;
}

async function gravarPasso(conducao: ConducaoDoWizard, index: number): Promise<string[]> {
  const { store } = conducao;
  const validator = conducao.passoNo(index);
  if (validator === undefined) return [];

  // Confere localmente antes de gravar, para não mandar ao servidor o comando de um passo que o
  // operador ainda não terminou de preencher, e para manter a ordem e o texto de
  // `validarRascunho()`: quem lê "Passo 1" quer o primeiro passo REALMENTE incompleto.
  const conferencia = validator.validar();
  if (!conferencia.valid) return [conducao.pendenciaDoPasso(index, mensagensDe(conferencia))];

  if (!validator.persistir) return [];

  const geracao = store.geracao();
  const commit = await validator
    .persistir({ confirmadaPeloOperador: false })
    .catch(falhaAoConcluir);
  if (geracao !== store.geracao()) return [];

  if (!commit.valid) {
    return commit.messages?.length === 0
      ? []
      : [conducao.pendenciaDoPasso(index, mensagensDe(commit))];
  }
  return gravarDesempatePendente(conducao);
}

async function gravarDesempatePendente(conducao: ConducaoDoWizard): Promise<string[]> {
  const recusa = await conducao.gravarDesempatePendente();
  if (recusa === null || recusa.mensagens.length === 0) return [];
  return [conducao.pendenciaDoPasso(recusa.indice, recusa.mensagens)];
}
