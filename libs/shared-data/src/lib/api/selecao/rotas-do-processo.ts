function caminho(...segmentos: readonly string[]): string {
  return segmentos.map(encodeURIComponent).join('/');
}

export function rotasDoProcesso(basePath: string) {
  const raiz = `${basePath}/api/selecao`;
  const colecao = (): string => `${raiz}/processos-seletivos`;

  return {
    colecao,
    doProcesso: (id: string, ...segmentos: readonly string[]): string =>
      `${colecao()}/${caminho(id, ...segmentos)}`,
    doProcessoNaAdministracao: (id: string, ...segmentos: readonly string[]): string =>
      `${raiz}/admin/processos-seletivos/${caminho(id, ...segmentos)}`,
    doCatalogo: (nome: string): string => `${raiz}/${nome}`,
  };
}
