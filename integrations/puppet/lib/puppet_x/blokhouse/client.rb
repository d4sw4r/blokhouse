# frozen_string_literal: true

require 'json'
require 'net/http'
require 'openssl'
require 'uri'
require 'yaml'

module PuppetX
  module Blokhouse
    # An error response from Blokhouse, or a failure to reach it.
    class Error < StandardError
      attr_reader :status, :code, :details

      def initialize(message, status: nil, code: nil, details: nil)
        @status = status
        @code = code
        @details = details || []
        text = status ? "HTTP #{status} #{code || 'error'}: #{message}" : message
        @details.each { |d| text += "; #{d['path'] || '(body)'}: #{d['message']}" }
        super(text)
      end
    end

    # Settings from blokhouse.yaml (written by class blokhouse).
    module Config
      DEFAULT_PATH = '/etc/puppetlabs/puppet/blokhouse.yaml'

      def self.path
        ENV['BLOKHOUSE_CONFIG'] || (defined?(Puppet) && Puppet.settings ? File.join(Puppet[:confdir], 'blokhouse.yaml') : DEFAULT_PATH)
      end

      def self.load(file = path)
        raise Error, "Blokhouse config #{file} not found (see class blokhouse)" unless File.exist?(file)

        config = YAML.safe_load(File.read(file)) || {}
        raise Error, "#{file}: expected a hash" unless config.is_a?(Hash)

        %w[url token].each { |key| raise Error, "#{file}: '#{key}' is not set" if config[key].to_s.empty? }
        config
      end
    end

    # Minimal client for the Blokhouse API v1 (Ruby standard library only).
    class Client
      def initialize(config)
        base = config['url'].sub(%r{/+\z}, '')
        @root = base.sub(%r{/api/v1\z}, '')
        @token = config['token']
        @verify = config.fetch('verify_ssl', true)
        @ca_file = config['ca_file']
        @timeout = Integer(config.fetch('timeout', 10))
      end

      def self.segment(value)
        URI.encode_www_form_component(value.to_s).gsub('+', '%20')
      end

      def item_by_external_id(source, external_id)
        get_or_nil("/api/v1/configuration-items/by-external-id/#{self.class.segment(source)}/#{self.class.segment(external_id)}")
      end

      # The item with this name; nil if there is none or several share it.
      def item_by_name(name)
        get_or_nil("/api/v1/configuration-items/by-name/#{self.class.segment(name)}")
      rescue Error => e
        raise unless e.status == 409

        nil
      end

      def update_item(id, fields)
        request(:patch, "/api/v1/configuration-items/#{self.class.segment(id)}", fields)['data']
      end

      # Returns [result, item]; result is "created", "updated" or "unchanged".
      def upsert_by_external_id(source, external_id, fields)
        body = request(:put, "/api/v1/configuration-items/by-external-id/#{self.class.segment(source)}/#{self.class.segment(external_id)}", fields)
        [body['result'], body['data']]
      end

      # Raw GET, used by the ENC script for /api/puppet.
      def get_text(path)
        response = http_request(:get, path, nil, 'text/yaml, application/json')
        return response.body if response.is_a?(Net::HTTPSuccess)

        raise error_from(response)
      end

      def request(method, path, body = nil)
        response = http_request(method, path, body, 'application/json')
        raise error_from(response) unless response.is_a?(Net::HTTPSuccess)

        response.body.to_s.empty? ? {} : JSON.parse(response.body)
      end

      private

      def get_or_nil(path)
        request(:get, path)['data']
      rescue Error => e
        raise unless e.status == 404

        nil
      end

      def http_request(method, path, body, accept)
        uri = URI.parse(@root + path)
        http = Net::HTTP.new(uri.host, uri.port)
        http.open_timeout = @timeout
        http.read_timeout = @timeout
        if uri.scheme == 'https'
          http.use_ssl = true
          http.verify_mode = @verify ? OpenSSL::SSL::VERIFY_PEER : OpenSSL::SSL::VERIFY_NONE
          http.ca_file = @ca_file if @ca_file
        end
        klass = { get: Net::HTTP::Get, put: Net::HTTP::Put, patch: Net::HTTP::Patch }.fetch(method)
        req = klass.new(uri.request_uri)
        req['Authorization'] = "Bearer #{@token}"
        req['Accept'] = accept
        req['User-Agent'] = 'blokhouse-puppet/0.1.0'
        if body
          req['Content-Type'] = 'application/json'
          req.body = JSON.generate(body)
        end
        http.request(req)
      rescue SocketError, SystemCallError, Timeout::Error, OpenSSL::SSL::SSLError, IOError => e
        raise Error, "Cannot reach Blokhouse at #{@root}: #{e.message}"
      end

      def error_from(response)
        err = JSON.parse(response.body.to_s)['error']
        if err.is_a?(Hash)
          Error.new(err['message'], status: response.code.to_i, code: err['code'], details: err['details'])
        else
          Error.new(err.to_s, status: response.code.to_i)
        end
      rescue JSON::ParserError, NoMethodError
        Error.new(response.message.to_s, status: response.code.to_i)
      end
    end
  end
end
