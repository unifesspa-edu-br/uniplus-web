/**
 * Espelha a verificação feita ao publicar: o formulário pergunta ao candidato algo cujo domínio sai desta
 * oferta, e a oferta não declara valor nenhum. Descobrir isso na revisão obriga a refazer o
 * caminho, e a mensagem de lá fala de "fato coletável", não do que preencher.
 */
export function mensagensDeFatosSemOferta(fatos: readonly string[]): string[] {
  return fatos.map(
    (pendente) =>
      `O formulário de inscrição pergunta ${pendente} ao candidato, e esta oferta não declara nenhum valor para escolher. Declare ao menos um, ou retire o campo do formulário.`,
  );
}

const TIPOS_SEM_CONDICAO_PCD =
  'Tipos de deficiência exigem a condição "Pessoa com deficiência" marcada entre as condições aceitas.';
const CONDICAO_PCD_SEM_TIPOS =
  'A condição "Pessoa com deficiência" exige ao menos um tipo de deficiência marcado. Marque um tipo ou desmarque a condição.';

/** A regra do PcD nas duas direções (ADR-0067): tipos exigem a condição, e a condição exige tipos. */
export function mensagensDaRegraDePcd(
  quantidadeDeTipos: number,
  pcdSelecionada: boolean,
): string[] {
  const temTipos = quantidadeDeTipos > 0;
  if (temTipos === pcdSelecionada) return [];
  return [temTipos ? TIPOS_SEM_CONDICAO_PCD : CONDICAO_PCD_SEM_TIPOS];
}
