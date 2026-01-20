// Arquivo de utilitários gerais (Vazio ou para uso futuro)
export const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
