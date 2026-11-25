/**
 * lib/puppet-enc.js
 * Puppet External Node Classifier (ENC) output for configuration items.
 *
 * Classification comes from two optional custom fields on the item:
 *   puppet_classes      classes to include, separated by commas or whitespace
 *                       ("role::web, profile::monitoring")
 *   puppet_environment  Puppet environment to assign ("production")
 * Without them the ENC sets no classes and no environment, so nodes keep the
 * environment they ask for and site.pp stays in charge.
 *
 * Every item field is also passed as top-scope variable $blokhouse (a hash).
 *
 * The output is JSON, which is valid YAML, so values never need hand-escaping.
 */

export const CLASSES_FIELD = "puppet_classes";
export const ENVIRONMENT_FIELD = "puppet_environment";

/**
 * Converts a human-readable name into a Puppet-safe identifier.
 * e.g. "Web Server" → "web_server"
 * @param {string} name
 * @returns {string}
 */
export function toPuppetIdentifier(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/** "role::web, profile::base\nprofile::x" → ["role::web", "profile::base", "profile::x"] */
export function parseClassList(value) {
    if (!value) return [];
    return [...new Set(String(value).split(/[\s,]+/).filter(Boolean))];
}

/**
 * ENC data for a configuration item in API v1 shape (see serializeItem in
 * lib/api/v1/items.ts): type and tags are names, customFields is {name: value}.
 */
export function buildENC(item) {
    const custom = item.customFields || {};
    const enc = {
        classes: Object.fromEntries(parseClassList(custom[CLASSES_FIELD]).map((c) => [c, {}])),
        parameters: {
            blokhouse: {
                id: item.id,
                name: item.name,
                description: item.description ?? null,
                ip: item.ip ?? null,
                mac: item.mac ?? null,
                status: item.status,
                type: item.type ?? null,
                tags: item.tags || [],
                custom_fields: custom,
                source: item.source ?? null,
                external_id: item.externalId ?? null,
            },
            // Variables of Blokhouse 0.2 and earlier, kept for existing manifests.
            blokhouse_id: item.id,
            blokhouse_name: item.name,
            ...(item.description && { description: item.description }),
            ...(item.ip && { ip_address: item.ip }),
            ...(item.mac && { mac_address: item.mac }),
            ...(item.type && { item_type: item.type }),
            managed_by: "blokhouse",
        },
    };
    const environment = String(custom[ENVIRONMENT_FIELD] ?? "").trim();
    if (environment) enc.environment = environment;
    return enc;
}

/** ENC data for a node that is not in Blokhouse: no classes, no environment. */
export function buildUnknownENC() {
    return { classes: {}, parameters: { blokhouse_managed: false } };
}

/** Serialize ENC data as a YAML document. */
export function encToYaml(enc) {
    return "---\n" + JSON.stringify(enc, null, 2) + "\n";
}
