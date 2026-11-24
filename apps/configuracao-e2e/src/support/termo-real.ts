import { expect, type Page } from '@playwright/test';
import { acharNaListagem, chamarApi } from '@uniplus/shared-e2e';
import { PERSONA_DA_CONFIGURACAO, type OpcaoDoVocabulario } from './vocabularios-reais';

/** O termo de consentimento pela tela e pela API real, só com o que o cadastro do rascunho pede. */
export interface TermoGravado {
  readonly id: string;
  readonly nome: string;
  readonly formaAceiteRascunho: OpcaoDoVocabulario;
}

export function escolherFormaDeAceite(
  formas: readonly OpcaoDoVocabulario[],
  padrao: string,
): OpcaoDoVocabulario {
  const forma = formas.filter((o) => o.codigo !== padrao).at(-1);
  if (forma === undefined) throw new Error('O vocabulário não traz forma além da padrão.');
  return forma;
}

export function termoNaApi(nome: string): Promise<TermoGravado | undefined> {
  return acharNaListagem<TermoGravado>(
    PERSONA_DA_CONFIGURACAO,
    '/api/configuracao/termos-consentimento?limit=100',
    (t) => t.nome === nome,
  );
}

/** Cria o termo só com nome e forma de aceite, que a pessoa escolhe pelo rótulo. */
export async function criarTermoPelaTela(
  pagina: Page,
  nome: string,
  forma: OpcaoDoVocabulario,
): Promise<void> {
  await pagina.getByRole('textbox', { name: /^Nome/ }).fill(nome);
  await pagina
    .getByRole('combobox', { name: /^Forma de aceite/ })
    .selectOption({ label: forma.rotulo });
  await pagina.getByRole('button', { name: 'Criar termo' }).click();
  await expect(pagina.getByRole('heading', { level: 1, name: nome })).toBeVisible();
}

/** Volta à lista pela própria tela, sem recarregar a página, e acha o termo pelo nome. */
export async function acharTermoNaLista(pagina: Page, nome: string) {
  await pagina.getByRole('link', { name: 'Voltar à lista' }).click();
  await pagina.getByRole('searchbox', { name: 'Buscar por nome' }).fill(nome);
  return pagina.getByRole('row').filter({ hasText: nome });
}

/** Remove o termo criado pela spec; sem ele na base, não há o que remover. */
export async function removerTermo(nome: string): Promise<void> {
  const gravado = await termoNaApi(nome);
  if (gravado === undefined) return;
  const resposta = await chamarApi(
    PERSONA_DA_CONFIGURACAO,
    'DELETE',
    `/api/configuracao/admin/termos-consentimento/${gravado.id}`,
  );
  expect(resposta.status, `Remoção do termo ${nome}`).toBeLessThan(300);
}
