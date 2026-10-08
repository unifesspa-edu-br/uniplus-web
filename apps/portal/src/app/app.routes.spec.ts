import { describe, expect, it } from 'vitest';
import { appRoutes } from './app.routes';

describe('appRoutes do Portal', () => {
  it('leva uma URL desconhecida para /processos', () => {
    const curinga = appRoutes.find((rota) => rota.path === '**');
    expect(curinga?.redirectTo).toBe('processos');
  });

  it('não registra mais a rota /perfil — o perfil é o modal do menu do avatar', () => {
    const caminhos = appRoutes.flatMap((rota) => [
      rota.path,
      ...(rota.children?.map((filha) => filha.path) ?? []),
    ]);
    expect(caminhos).not.toContain('perfil');
  });
});
