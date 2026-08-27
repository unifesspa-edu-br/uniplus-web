import { ActivatedRouteSnapshot, BaseRouteReuseStrategy } from '@angular/router';

/**
 * Chave que declara duas rotas como a **mesma tela** para efeito de reuso.
 *
 * O caso que motiva isto é o editor de Processo Seletivo: `/processo-seletivo/novo`
 * e `/processo-seletivo/:id` renderizam o mesmo componente, e a passagem de uma
 * para a outra acontece no meio do cadastro — assim que a criação responde com
 * o UUID. Para o roteador padrão são configurações distintas, então a transição
 * destrói e recria a página: o wizard voltaria ao passo 1, perderia os campos
 * que só existem no rascunho local e abandonaria o upload em curso.
 */
export const ROTA_REUSE_KEY = 'reuseKey';

/**
 * Trata como a mesma rota, para fins de reuso, as que declaram a mesma
 * `reuseKey` em `data`.
 *
 * A alternativa seria trocar o endereço por `Location.replaceState`, que não
 * passa pelo roteador. Ela preserva o componente, mas deixa `routerState` e
 * `NavigationEnd` para trás — e tudo que deriva deles, como o breadcrumb do
 * shell, continua descrevendo a rota anterior. Reusar a rota resolve os dois
 * lados: a instância sobrevive e o estado do roteador acompanha o endereço.
 *
 * O reuso vale só entre rotas que se declaram equivalentes; o resto do
 * aplicativo mantém o comportamento padrão.
 */
export class EditorRouteReuseStrategy extends BaseRouteReuseStrategy {
  override shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    const chaveFutura: unknown = future.data[ROTA_REUSE_KEY];
    const chaveAtual: unknown = curr.data[ROTA_REUSE_KEY];

    if (typeof chaveFutura === 'string' && chaveFutura === chaveAtual) {
      return true;
    }

    return super.shouldReuseRoute(future, curr);
  }
}
