// lib/validation.ts
// Validation utilities for IP addresses and MAC addresses

/**
 * Validates an IPv4 address
 * Returns true if valid, false otherwise
 */
export function isValidIPv4(ip: string): boolean {
    if (!ip || ip.trim() === "") return true; // Empty is valid (optional field)
    
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ip.trim());
}

/**
 * Validates an IPv6 address (basic validation)
 * Returns true if valid, false otherwise
 */
export function isValidIPv6(ip: string): boolean {
    if (!ip || ip.trim() === "") return true; // Empty is valid (optional field)
    
    // Basic IPv6 validation - checks for valid hex groups
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
    return ipv6Regex.test(ip.trim());
}

/**
 * Validates either IPv4 or IPv6
 */
export function isValidIP(ip: string): boolean {
    if (!ip || ip.trim() === "") return true;
    return isValidIPv4(ip) || isValidIPv6(ip);
}

/**
 * Validates a MAC address
 * Supports formats: XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX, XXXX.XXXX.XXXX
 */
export function isValidMAC(mac: string): boolean {
    if (!mac || mac.trim() === "") return true; // Empty is valid (optional field)
    
    const cleanMac = mac.trim().toUpperCase();
    
    // Format: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX
    const macRegex1 = /^([0-9A-F]{2}[:-]){5}([0-9A-F]{2})$/;
    // Format: XXXX.XXXX.XXXX
    const macRegex2 = /^[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}$/;
    // Format: XXXXXXXXXXXX (no separators)
    const macRegex3 = /^[0-9A-F]{12}$/;
    
    return macRegex1.test(cleanMac) || macRegex2.test(cleanMac) || macRegex3.test(cleanMac);
}

/**
 * Normalizes a MAC address to XX:XX:XX:XX:XX:XX format
 */
export function normalizeMAC(mac: string): string {
    if (!mac || !isValidMAC(mac)) return mac;
    
    const clean = mac.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
    return clean.match(/.{1,2}/g)?.join(":") || mac;
}

/**
 * Gets validation status color class
 */
export function getValidationColor(isValid: boolean, hasValue: boolean): string {
    if (!hasValue) return "border-gray-300";
    return isValid ? "border-green-500 focus:border-green-500 focus:ring-green-500" : "border-red-500 focus:border-red-500 focus:ring-red-500";
}

/**
 * Gets validation status message
 */
export function getValidationMessage(isValid: boolean, fieldName: string): string | null {
    if (isValid) return null;
    return `Invalid ${fieldName} format`;
}
