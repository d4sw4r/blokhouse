# frozen_string_literal: true

require 'json'
require 'time'
require_relative 'client'

module PuppetX
  module Blokhouse
    # Turns a Puppet report and the node's facts into a Blokhouse upsert.
    #
    # The item is identified by source "puppet" + externalId = certname. If no
    # such item exists yet, an item named like the node without an external
    # identity is adopted instead of creating a duplicate.
    #
    # Always updated: ip, mac, lastSeenAt and the configured custom fields.
    # Only set when the item is created: name, type and tags, so changes made
    # in Blokhouse are not overwritten on the next run.
    class Reporter
      SOURCE = 'puppet'
      REPORT_VALUES = %w[status environment puppet_version configuration_version time transaction_uuid].freeze

      def initialize(config, client = Client.new(config))
        @config = config
        @client = client
      end

      # Returns the upsert result ("created", "updated", "unchanged").
      def run(report, facts)
        certname = report.host
        fields = compact(
          'ip' => fact(facts, 'networking.ip') || fact(facts, 'ipaddress'),
          'mac' => fact(facts, 'networking.mac') || fact(facts, 'macaddress'),
          'lastSeenAt' => report.time&.utc&.iso8601,
        )
        custom = custom_fields(report, facts)
        fields['customFields'] = custom unless custom.empty?

        existing = @client.item_by_external_id(SOURCE, certname) || adopt(certname, facts)
        fields.merge!(creation_fields(certname, facts)) unless existing

        result, = @client.upsert_by_external_id(SOURCE, certname, fields)
        result
      end

      # Configured custom fields: {"os" => "facts.os.name", "puppet_status" => "report.status"}.
      def custom_fields(report, facts)
        (@config['custom_fields'] || {}).each_with_object({}) do |(field, path), out|
          value = resolve(path.to_s, report, facts)
          out[field.to_s] = stringify(value) unless value.nil? || value == ''
        end
      end

      private

      def adopt(certname, facts)
        names = [certname, fact(facts, 'networking.fqdn'), fact(facts, 'networking.hostname')].compact.uniq
        names.each do |name|
          item = @client.item_by_name(name)
          next unless item
          # An item owned by another source (e.g. vmware) keeps its identity.
          return nil unless item['source'].nil?

          return @client.update_item(item['id'], 'source' => SOURCE, 'externalId' => certname)
        end
        nil
      end

      def creation_fields(certname, facts)
        name = case @config.fetch('name', 'certname')
               when 'hostname' then fact(facts, 'networking.hostname')
               when 'fqdn' then fact(facts, 'networking.fqdn')
               end
        type = @config['type'] || (truthy(fact(facts, 'is_virtual')) ? 'VM' : 'Server')
        compact('name' => name || certname, 'type' => type, 'tags' => @config['tags'])
      end

      def resolve(path, report, facts)
        scope, rest = path.split('.', 2)
        case scope
        when 'facts' then fact(facts, rest)
        when 'report'
          raise Error, "unknown report value '#{rest}' (one of #{REPORT_VALUES.join(', ')})" unless REPORT_VALUES.include?(rest)

          value = report.public_send(rest)
          value.respond_to?(:utc) ? value.utc.iso8601 : value
        else
          raise Error, "custom field source '#{path}' must start with 'facts.' or 'report.'"
        end
      end

      def fact(facts, path)
        path.to_s.split('.').reduce(facts) { |v, key| v.is_a?(Hash) ? v[key] : nil }
      end

      def stringify(value)
        case value
        when Array then value.map(&:to_s).join(', ')
        when Hash then JSON.generate(value)
        when Numeric, true, false then value
        else value.to_s
        end
      end

      def truthy(value)
        [true, 'true'].include?(value)
      end

      def compact(hash)
        hash.reject { |_, v| v.nil? || v == '' }
      end
    end
  end
end
