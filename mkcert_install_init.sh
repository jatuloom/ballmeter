# Install mkcert
sudo apt install -y mkcert libnss3-tools

# Create local CA
mkcert -install

# Creat the certs directory if it doesn't exist
mkdir -p ~/ballMeter/certs

# Generate certs for your LAN IP (adjust IP if different)
mkcert -cert-file ~/ballMeter/certs/cert.pem -key-file ~/ballMeter/certs/key.pem 192.168.1.119 localhost 127.0.0.1
