function caminho(...segmentos: readonly string[]): string {
  return segmentos.map(encodeURIComponent).join('/');
}

export function rotasDoProcesso(basePath: string) {
  const enderecoDaSelecao = `${basePath}/api/selecao`;
  const colecao = (): string => `${enderecoDaSelecao}/processos-seletivos`;

  return {
    colecao,
    doProcesso: (id: string, ...segmentos: readonly string[]): string =>
      `${colecao()}/${caminho(id, ...segmentos)}`,
    doProcessoNaAdministracao: (id: string, ...segmentos: readonly string[]): string =>
      `${enderecoDaSelecao}/admin/processos-seletivos/${caminho(id, ...segmentos)}`,
    doCatalogo: (nome: string): string => `${enderecoDaSelecao}/${nome}`,
    doVocabulario: (nome: string): string => `${enderecoDaSelecao}/vocabularios/${caminho(nome)}`,
  };
}
