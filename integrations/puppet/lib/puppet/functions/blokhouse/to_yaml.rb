# frozen_string_literal: true

require 'yaml'

# Serialize data as YAML (used for blokhouse.yaml; avoids a dependency on stdlib).
Puppet::Functions.create_function(:'blokhouse::to_yaml') do
  dispatch :to_yaml do
    param 'Hash', :data
    return_type 'String'
  end

  def to_yaml(data)
    data.to_yaml
  end
end
