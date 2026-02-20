# Blokhouse

This project aims to be a easy and simple to use CMDB, build with a automation first approach. The goal should be to have an easy to setup CMDB with all your assets, which then can be filled and read with automation tools like ansible, puppet, ect. and custom REST-API scripts, depending on your infrastructure.


## Quick start
```bash
git clone https://github.com/d4sw4r/blokhouse.git
cd blokhouse
docker compose up
```
(BUG: Maybe migrations take too long and a second inital start is required)

This will start the app container + database, and your application should be accessible at [http://localhost:3000](http://localhost:3000) .


## ansible
```yaml
# my-dynamic-inventory.yml
plugin: uri
url: http://localhost:3000/api/ansible
validate_certs: false
```

(See Ansible's documentation on dynamic inventories for details.)

## puppet

Blokhouse acts as a **Puppet External Node Classifier (ENC)**. Configure your Puppet master to call the endpoint per-node.

```ini
# /etc/puppet/puppet.conf or /etc/puppetlabs/puppet/puppet.conf
[master]
external_nodes = curl -sf -H 'Authorization: Bearer YOUR_API_TOKEN' http://localhost:3000/api/puppet?node=%s
node_terminus  = exec
```

The ENC returns YAML with classes, parameters and environment derived from the asset's type:

```yaml
---
classes:
  webserver:
parameters:
  blokhouse_id: "clxyz..."
  blokhouse_name: "web-01"
  ip_address: "192.168.1.10"
  item_type: "webserver"
  managed_by: "blokhouse"
environment: webserver
```

List all nodes (JSON overview):
```bash
curl -H 'Authorization: Bearer YOUR_API_TOKEN' http://localhost:3000/api/puppet
```

## chef

Blokhouse exposes a **Chef-compatible node inventory**. Use it to bootstrap node attributes or build a custom `knife` plugin.

```bash
# All nodes as Chef::Node objects
curl -H 'Authorization: Bearer TOKEN' http://localhost:3000/api/chef

# Single node (knife node show format)
curl -H 'Authorization: Bearer TOKEN' http://localhost:3000/api/chef?node=web-01

# Chef Data Bag (data_bags/blokhouse/*)
curl -H 'Authorization: Bearer TOKEN' 'http://localhost:3000/api/chef?format=databag'
```

Example node object returned:

```json
{
  "name": "web-01",
  "chef_type": "node",
  "chef_environment": "webserver",
  "run_list": ["role[webserver]"],
  "automatic": { "ipaddress": "192.168.1.10", "hostname": "web-01" },
  "normal": {
    "blokhouse": { "id": "clxyz...", "managed": true }
  }
}
```

## Getting Started

First, run the development server:
Start a postgres server and add your connectionstring to env.local e.g.
```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET="random-string"
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/mydatabase
```
Then update schema and seed the db:
```bash
npx prisma db push
npx prisma db seed
```
Now you can start your dev instance:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

There is a inital admin user:
admin@example.com
admin


## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!


