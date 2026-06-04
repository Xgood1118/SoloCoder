const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateCerts() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });

  const certDir = path.join(__dirname, '../../certs');
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }

  const cert = `-----BEGIN CERTIFICATE-----
MIIC8DCCAligAwIBAgIJAIv0Q
${crypto.randomBytes(16).toString('hex')}MA0GCSqGSIb3DQEBCwUAMHwxCzAJ
BgNVBAYTAkNOMQwwCgYDVQQIDANCSUoxDDAKBgNVBAcMA0JESDELMA
-----END CERTIFICATE-----`;

  fs.writeFileSync(path.join(certDir, 'server-key.pem'), privateKey);
  fs.writeFileSync(path.join(certDir, 'server-cert.pem'), publicKey);
  
  console.log('Certificates generated in certs/ directory');
}

generateCerts();
