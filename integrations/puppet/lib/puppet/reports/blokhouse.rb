# frozen_string_literal: true

require 'puppet'
require_relative '../../puppet_x/blokhouse/reporter'

Puppet::Reports.register_report(:blokhouse) do
  desc <<-DESC
    Updates the node's configuration item in Blokhouse after every run: IP and
    MAC address, "last seen" time and the custom fields configured in
    blokhouse.yaml. Creates the item if it does not exist.

    Enable it on the Puppet server with `reports = store,blokhouse` and
    configure it with class `blokhouse`.
  DESC

  def process
    config = PuppetX::Blokhouse::Config.load
    facts = Puppet::Node::Facts.indirection.find(host)
    raise PuppetX::Blokhouse::Error, 'no facts found for this node' unless facts

    result = PuppetX::Blokhouse::Reporter.new(config).run(self, facts.values)
    Puppet.info("Blokhouse: #{host} #{result}")
  rescue StandardError => e
    # Never fail report processing because the CMDB is unreachable.
    Puppet.err("Blokhouse: could not update #{host}: #{e.message}")
  end
end
