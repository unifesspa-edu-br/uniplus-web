import { json, semConteudo, type Requisicao, type Rota } from './resposta';

function listar({ route, url, estado }: Requisicao): Promise<void> {
  const situacao = url.searchParams.get('situacao') ?? 'ativa';
  return json(
    route,
    estado.concessoes.filter(
      (c) => situacao === 'todas' || (situacao === 'ativa' ? c.ativa : !c.ativa),
    ),
  );
}

function revogar({ route, url, estado }: Requisicao): Promise<void> {
  const alvo = estado.concessoes.find((c) => url.pathname.includes(c.id));
  if (!alvo) return json(route, {}, 404);
  estado.revogacoes.push(route.request().postDataJSON());
  alvo.ativa = false;
  alvo.revogadaEm = '2026-10-29T11:00:00Z';
  return semConteudo(route);
}

export const ROTAS_DE_CONCESSOES: readonly Rota[] = [
  { caminho: /\/concessoes$/u, metodo: 'GET', responder: listar },
  { caminho: /\/concessoes\/[^/]+\/trilha$/u, responder: ({ route }) => json(route, []) },
  { caminho: /\/revogacao$/u, responder: revogar },
];
