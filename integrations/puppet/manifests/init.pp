# @summary Configure the Blokhouse report processor and ENC script on a Puppet server.
#
# Writes blokhouse.yaml (URL, token, mapping) and installs the ENC script.
# Enabling them in puppet.conf is up to you:
#
#   [server]
#   reports        = store,blokhouse
#   node_terminus  = exec                                   # optional: ENC
#   external_nodes = /etc/puppetlabs/puppet/blokhouse_enc   # optional: ENC
#
# @example
#   class { 'blokhouse':
#     url           => 'https://cmdb.example.com',
#     token         => Sensitive(lookup('blokhouse::token')),
#     custom_fields => {
#       'os'            => 'facts.os.name',
#       'os_release'    => 'facts.os.release.full',
#       'puppet_status' => 'report.status',
#     },
#   }
#
# @param url
#   Base URL of Blokhouse.
# @param token
#   API token. The report processor needs the `write` scope, the ENC `read`.
# @param verify_ssl
#   Verify the TLS certificate of Blokhouse.
# @param ca_file
#   CA bundle for Blokhouse's certificate, if it is not in the system store.
# @param timeout
#   HTTP timeout in seconds.
# @param custom_fields
#   Custom fields to report: Blokhouse field name => `facts.<path>` or
#   `report.<status|environment|puppet_version|configuration_version|time>`.
#   The fields must exist in Blokhouse (Admin > Custom Fields).
# @param type
#   Type for newly created items. Default: VM for virtual machines, else Server.
# @param tags
#   Tags for newly created items.
# @param item_name
#   Name for newly created items: the certname, or the `fqdn` or `hostname` fact.
# @param manage_enc
#   Install the ENC script.
# @param config_path
#   Where to write the settings. The report processor reads `$confdir/blokhouse.yaml`.
# @param enc_path
#   Where to install the ENC script.
# @param ruby
#   Ruby interpreter for the ENC script.
# @param owner
#   Owner of blokhouse.yaml. The Puppet server process must be able to read it.
# @param group
#   Group of blokhouse.yaml.
class blokhouse (
  Pattern[/\Ahttps?:\/\/./] $url,
  Sensitive[String[1]] $token,
  Boolean $verify_ssl = true,
  Optional[Pattern[/\A\//]] $ca_file = undef,
  Integer[1] $timeout = 10,
  Hash[String[1], Pattern[/\A(facts|report)\./]] $custom_fields = {},
  Optional[String[1]] $type = undef,
  Array[String[1]] $tags = [],
  Enum['certname', 'fqdn', 'hostname'] $item_name = 'certname',
  Boolean $manage_enc = true,
  Pattern[/\A\//] $config_path = "${settings::confdir}/blokhouse.yaml",
  Pattern[/\A\//] $enc_path = "${settings::confdir}/blokhouse_enc",
  Pattern[/\A\//] $ruby = '/opt/puppetlabs/puppet/bin/ruby',
  String[1] $owner = 'puppet',
  String[1] $group = 'puppet',
) {
  $settings = {
    'url'           => $url,
    'token'         => $token.unwrap,
    'verify_ssl'    => $verify_ssl,
    'ca_file'       => $ca_file,
    'timeout'       => $timeout,
    'custom_fields' => $custom_fields,
    'type'          => $type,
    'tags'          => $tags,
    'name'          => $item_name,
  }.filter |$k, $v| { $v =~ NotUndef and $v != [] }

  file { $config_path:
    ensure    => file,
    owner     => $owner,
    group     => $group,
    mode      => '0640',
    content   => Sensitive(blokhouse::to_yaml($settings)),
    show_diff => false,
  }

  if $manage_enc {
    file { $enc_path:
      ensure  => file,
      owner   => 'root',
      group   => 'root',
      mode    => '0755',
      content => epp('blokhouse/blokhouse_enc.epp', { 'ruby' => $ruby, 'config' => $config_path }),
    }
  }
}
