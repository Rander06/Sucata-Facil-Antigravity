import { formatInTimeZone } from 'date-fns-tz';
import { parseISO } from 'date-fns';

const BRAZIL_TZ = 'America/Sao_Paulo';

/**
 * Formata data UTC para timezone do Brasil
 * @param date - Data em formato UTC (string ou Date)
 * @param format - Formato de saída (padrão: 'dd/MM/yyyy HH:mm')
 * @returns Data formatada no timezone do Brasil
 */
export function formatBRDate(
    date: string | Date,
    format: string = 'dd/MM/yyyy HH:mm'
): string {
    if (!date) return '';
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatInTimeZone(dateObj, BRAZIL_TZ, format);
}

/**
 * Extrai apenas a data (YYYY-MM-DD) no timezone do Brasil
 * Útil para comparações de filtro de data
 * @param date - Data em formato UTC
 * @returns Data no formato YYYY-MM-DD (Brasil)
 */
export function getBRDateOnly(date: string | Date): string {
    if (!date) return '';
    return formatBRDate(date, 'yyyy-MM-dd');
}

/**
 * Retorna data/hora atual do Brasil
 * @returns Date object com horário atual
 */
export function getBRNow(): Date {
    return new Date();
}

/**
 * Retorna a data de hoje no formato YYYY-MM-DD (Brasil)
 * @returns String no formato YYYY-MM-DD
 */
export function getTodayBR(): string {
    return formatInTimeZone(new Date(), BRAZIL_TZ, 'yyyy-MM-dd');
}

/**
 * Retorna a data X dias atrás no formato YYYY-MM-DD (Brasil)
 * @param daysAgo - Número de dias atrás
 * @returns String no formato YYYY-MM-DD
 */
export function getDaysAgoBR(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return formatInTimeZone(date, BRAZIL_TZ, 'yyyy-MM-dd');
}
