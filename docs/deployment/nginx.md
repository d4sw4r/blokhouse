# nginx Reverse Proxy

Running Blokhouse behind nginx is recommended for production — it handles SSL termination and proper header forwarding.

## Basic HTTP → HTTPS Setup

```nginx
# /etc/nginx/sites-available/blokhouse
server {
    listen 80;
    server_name blokhouse.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name blokhouse.example.com;

    ssl_certificate     /etc/letsencrypt/live/blokhouse.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blokhouse.example.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Required for NextAuth and proper URL generation
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (used by Next.js dev and hot reload)
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 60s;
        proxy_buffering off;
    }
}
```

Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/blokhouse /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d blokhouse.example.com
```

## Important: Update NEXTAUTH_URL

After setting up nginx with HTTPS, update your `.env`:

```bash
NEXTAUTH_URL=https://blokhouse.example.com
```

NextAuth will reject requests if `NEXTAUTH_URL` does not match the actual URL used in the browser.
