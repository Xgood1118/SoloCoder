const CryptoJS = require('crypto-js');
const config = require('../config');

function encrypt(text) {
  return CryptoJS.AES.encrypt(text, config.encryption.key).toString();
}

function decrypt(cipherText) {
  const bytes = CryptoJS.AES.decrypt(cipherText, config.encryption.key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

module.exports = { encrypt, decrypt };
