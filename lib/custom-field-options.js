// lib/custom-field-options.js
// CustomField.options is a JSON array stored as text. These helpers keep the
// conversion in one place so callers always work with real arrays.

/** Array (or undefined/null) -> JSON text for the database. */
export function serializeOptions(options) {
    if (options === undefined || options === null) return "[]";
    if (!Array.isArray(options)) throw new TypeError("options must be an array of strings");
    return JSON.stringify(options.map((o) => String(o).trim()).filter(Boolean));
}

/** JSON text from the database -> array of strings (never throws). */
export function parseOptions(text) {
    if (Array.isArray(text)) return text;
    try {
        const parsed = JSON.parse(text || "[]");
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
}

/** Return a copy of a CustomField record with `options` as an array. */
export function withParsedOptions(field) {
    return field ? { ...field, options: parseOptions(field.options) } : field;
}
