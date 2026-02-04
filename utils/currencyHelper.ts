
/**
 * Formata um valor numérico para o padrão de moeda brasileiro (pt-BR).
 * Garante sempre 2 casas decimais.
 * Exemplo: 1234.5 -> "1.234,50"
 * Exemplo: 0 -> "0,00"
 */
export const formatCurrency = (value: number | string | undefined | null): string => {
    const numericValue = typeof value === 'string' ? parseFloat(value) : value;

    if (numericValue === undefined || numericValue === null || isNaN(numericValue)) {
        return '0,00';
    }

    return numericValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};
