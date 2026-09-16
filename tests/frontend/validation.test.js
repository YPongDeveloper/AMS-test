const test = require('node:test');
const assert = require('node:assert/strict');

function isValidLandCode(code) {
  return /^LND-\d{4}-\d{3,4}$/.test(code);
}

function isValidGPS(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function isValidThailandBounds(lat, lng) {
  // Approximate Thailand bounding box: 5.5 to 20.5 N, 97.3 to 105.7 E
  return lat >= 5.5 && lat <= 20.5 && lng >= 97.3 && lng <= 105.7;
}

test('Validation - Land Code Format regex check', () => {
  assert.equal(isValidLandCode('LND-2569-001'), true);
  assert.equal(isValidLandCode('LND-2569-1234'), true);
  assert.equal(isValidLandCode('LND-99-01'), false);
  assert.equal(isValidLandCode('MALICIOUS_INPUT'), false);
  assert.equal(isValidLandCode('LND-2569-001; DROP TABLE'), false);
});

test('Validation - GPS coordinates range validation', () => {
  assert.equal(isValidGPS(13.7563, 100.5018), true); // Bangkok
  assert.equal(isValidGPS(91.0, 100.0), false); // Latitude out of bounds
  assert.equal(isValidGPS(13.75, 185.0), false); // Longitude out of bounds
  assert.equal(isValidGPS('13.75', 100.5), false); // String instead of number
});

test('Validation - Thailand Geographical Bounds check', () => {
  assert.equal(isValidThailandBounds(13.7563, 100.5018), true); // Bangkok - Thailand
  assert.equal(isValidThailandBounds(14.3532, 100.5684), true); // Ayutthaya - Thailand
  assert.equal(isValidThailandBounds(48.8566, 2.3522), false);   // Paris - France
  assert.equal(isValidThailandBounds(35.6762, 139.6503), false); // Tokyo - Japan
});
