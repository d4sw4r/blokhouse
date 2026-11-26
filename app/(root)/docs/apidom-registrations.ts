/*
 * Workaround for a Turbopack (Next.js 16.4) tree-shaking bug that breaks
 * swagger-ui-react with "OpenApi3_1Element.refract is not a function".
 *
 * Each @swagger-api/apidom-* namespace attaches the static `refract` methods
 * to its element classes in `src/refractor/registration.mjs`, which only
 * re-exports the classes it imports. Its package.json marks that file (and
 * only that file) as having side effects, so the package barrel
 * `src/index.mjs` is side-effect free. When swagger-client imports a class
 * from the barrel, Turbopack follows the re-export chain straight to
 * `src/elements/*.mjs` and skips `registration.mjs` even though it is
 * declared side-effectful, so its code never runs. (webpack keeps it.)
 *
 * Importing the registration modules directly from evaluated app code makes
 * Turbopack keep and run them. The list covers every apidom namespace that
 * swagger-client pulls into the docs page bundle. Remove this file once
 * Turbopack no longer drops side-effectful modules on re-export chains.
 */
import "../../../node_modules/@swagger-api/apidom-core/src/refractor/registration.mjs";
import "../../../node_modules/@swagger-api/apidom-ns-json-schema-draft-4/src/refractor/registration.mjs";
import "../../../node_modules/@swagger-api/apidom-ns-json-schema-draft-6/src/refractor/registration.mjs";
import "../../../node_modules/@swagger-api/apidom-ns-json-schema-draft-7/src/refractor/registration.mjs";
import "../../../node_modules/@swagger-api/apidom-ns-json-schema-2019-09/src/refractor/registration.mjs";
import "../../../node_modules/@swagger-api/apidom-ns-json-schema-2020-12/src/refractor/registration.mjs";
import "../../../node_modules/@swagger-api/apidom-ns-openapi-3-0/src/refractor/registration.mjs";
import "../../../node_modules/@swagger-api/apidom-ns-openapi-3-1/src/refractor/registration.mjs";
import "../../../node_modules/@swagger-api/apidom-ns-openapi-3-2/src/refractor/registration.mjs";
