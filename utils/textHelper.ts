/**
 * Normalizes text for search purposes by:
 * 1. Decomposing combined characters (NFD)
 * 2. Removing diacritical marks (accents)
 * 3. Converting to lowercase
 * 4. Removing extra whitespace
 * 
 * Example: "Depósito" -> "deposito"
 */
export const normalizeText = (text: string | null | undefined): string => {
    if (!text) return '';
    return String(text)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
};
