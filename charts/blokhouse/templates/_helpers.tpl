{{/* Chart name. */}}
{{- define "blokhouse.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Full name of the release's objects: the release name, suffixed with the
chart name unless it already contains it. */}}
{{- define "blokhouse.fullname" -}}
{{- if contains .Chart.Name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{- define "blokhouse.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/* Selector labels of the Blokhouse pods. */}}
{{- define "blokhouse.selectorLabels" -}}
app.kubernetes.io/name: {{ include "blokhouse.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: app
{{- end }}

{{/* Labels of the Blokhouse objects. */}}
{{- define "blokhouse.labels" -}}
helm.sh/chart: {{ include "blokhouse.chart" . }}
{{ include "blokhouse.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "blokhouse.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "blokhouse.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{- define "blokhouse.image" -}}
{{- printf "%s:%s" .Values.image.repository (default .Chart.AppVersion .Values.image.tag) }}
{{- end }}

{{/* A value as an environment variable string. Numbers from values files
arrive as floats; print integers without an exponent (2592000, not 2.592e+06). */}}
{{- define "blokhouse.envString" -}}
{{- if kindIs "float64" . }}
{{- int64 . | toString }}
{{- else }}
{{- toString . }}
{{- end }}
{{- end }}

{{/* The effective NEXTAUTH_URL. */}}
{{- define "blokhouse.url" -}}
{{- if .Values.blokhouse.url }}
{{- .Values.blokhouse.url }}
{{- else }}
{{- "http://localhost:8080" }}
{{- end }}
{{- end }}

{{/* Name of the Secret holding NEXTAUTH_SECRET, ADMIN_PASSWORD and OIDC_CLIENT_SECRET. */}}
{{- define "blokhouse.appSecretName" -}}
{{- default (include "blokhouse.fullname" .) .Values.blokhouse.existingSecret }}
{{- end }}

{{/*
Plain value of a chart-managed secret key: the value given in the values,
else the one already stored in the Secret (so upgrades keep it), else a new
random one. Results are cached for the render, so every template that needs
the same key (e.g. the database password in two Secrets) gets the same value.
Arguments: dict "ctx" $ "secret" <Secret name> "key" <key> "value" <given> "length" <n>
*/}}
{{- define "blokhouse.secretValue" -}}
{{- if .value }}
{{- .value }}
{{- else }}
{{- $cache := .ctx.Values._blokhouseGeneratedSecrets | default (dict) }}
{{- $_ := set .ctx.Values "_blokhouseGeneratedSecrets" $cache }}
{{- $cacheKey := printf "%s/%s" .secret .key }}
{{- if not (hasKey $cache $cacheKey) }}
{{- $existing := lookup "v1" "Secret" .ctx.Release.Namespace .secret }}
{{- $stored := dig "data" .key "" $existing }}
{{- $_ := set $cache $cacheKey (ternary (b64dec $stored) (randAlphaNum (int .length)) (ne $stored "")) }}
{{- end }}
{{- get $cache $cacheKey }}
{{- end }}
{{- end }}

{{/* PostgreSQL (bundled database) */}}

{{- define "blokhouse.postgresql.fullname" -}}
{{- printf "%s-postgresql" (include "blokhouse.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "blokhouse.postgresql.selectorLabels" -}}
app.kubernetes.io/name: {{ include "blokhouse.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: postgresql
{{- end }}

{{- define "blokhouse.postgresql.labels" -}}
helm.sh/chart: {{ include "blokhouse.chart" . }}
{{ include "blokhouse.postgresql.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/* Name of the Secret holding the bundled database password (key "password"). */}}
{{- define "blokhouse.postgresql.secretName" -}}
{{- default (include "blokhouse.postgresql.fullname" .) .Values.postgresql.auth.existingSecret }}
{{- end }}

{{/* Plain bundled database password managed by the chart. */}}
{{- define "blokhouse.postgresql.password" -}}
{{- include "blokhouse.secretValue" (dict "ctx" . "secret" (include "blokhouse.postgresql.fullname" .) "key" "password" "value" .Values.postgresql.auth.password "length" 24) }}
{{- end }}

{{/*
Where the app's DATABASE_URL comes from:
  chart          - the chart Secret (bundled database, or externalDatabase.url)
  bundledSecret  - built from postgresql.auth.existingSecret at container start
  externalSecret - externalDatabase.existingSecret
*/}}
{{- define "blokhouse.databaseUrlSource" -}}
{{- if .Values.postgresql.enabled }}
{{- ternary "bundledSecret" "chart" (ne .Values.postgresql.auth.existingSecret "") }}
{{- else if .Values.externalDatabase.existingSecret }}
{{- "externalSecret" }}
{{- else if .Values.externalDatabase.url }}
{{- "chart" }}
{{- else }}
{{- fail "Set externalDatabase.url or externalDatabase.existingSecret when postgresql.enabled=false" }}
{{- end }}
{{- end }}

{{/* DATABASE_URL of the bundled database with the given (already URL-safe) password. */}}
{{- define "blokhouse.postgresql.url" -}}
{{- $auth := .ctx.Values.postgresql.auth }}
{{- printf "postgresql://%s:%s@%s:5432/%s" (urlquery $auth.username) .password (include "blokhouse.postgresql.fullname" .ctx) $auth.database }}
{{- end }}

{{/* DATABASE_URL stored in the chart Secret (source "chart"). */}}
{{- define "blokhouse.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
{{- include "blokhouse.postgresql.url" (dict "ctx" . "password" (include "blokhouse.postgresql.password" . | urlquery)) }}
{{- else }}
{{- .Values.externalDatabase.url }}
{{- end }}
{{- end }}
