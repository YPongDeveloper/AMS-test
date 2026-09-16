const test = require('node:test');
const assert = require('node:assert/strict');

// Progressive tax calculation test based on Thailand Land and Building Tax Act B.E. 2562
function calculateLandTaxTest(baseValue, useType = "commercial") {
  if (baseValue <= 0) return { tax: 0, ratePercent: 0 };
  
  if (useType === "commercial" || useType === "other") {
    let tax = 0;
    let effectiveRate = 0.3;
    if (baseValue <= 50000000) {
      tax = baseValue * 0.003;
      effectiveRate = 0.3;
    } else if (baseValue <= 200000000) {
      tax = (50000000 * 0.003) + ((baseValue - 50000000) * 0.004);
      effectiveRate = (tax / baseValue) * 100;
    } else if (baseValue <= 1000000000) {
      tax = (50000000 * 0.003) + (150000000 * 0.004) + ((baseValue - 200000000) * 0.005);
      effectiveRate = (tax / baseValue) * 100;
    } else {
      tax = (50000000 * 0.003) + (150000000 * 0.004) + (800000000 * 0.005) + ((baseValue - 1000000000) * 0.006);
      effectiveRate = (tax / baseValue) * 100;
    }
    return { tax: Math.round(tax), ratePercent: parseFloat(effectiveRate.toFixed(4)) };
  } else if (useType === "agricultural") {
    if (baseValue <= 50000000) return { tax: 0, ratePercent: 0.01 };
    const taxable = baseValue - 50000000;
    const tax = taxable * 0.0001;
    return { tax: Math.round(tax), ratePercent: 0.01 };
  }
  
  return { tax: Math.round(baseValue * 0.0002), ratePercent: 0.02 };
}

test('Tax Engine - Commercial tier 1 (<= 50MB) 0.3% rate', () => {
  const res = calculateLandTaxTest(10000000, "commercial");
  assert.equal(res.tax, 30000);
  assert.equal(res.ratePercent, 0.3);
});

test('Tax Engine - Commercial tier 2 (50M - 200M) Progressive tiering', () => {
  const res = calculateLandTaxTest(100000000, "commercial");
  // 50M * 0.003 = 150,000 + 50M * 0.004 = 200,000 => Total 350,000
  assert.equal(res.tax, 350000);
  assert.equal(res.ratePercent, 0.35);
});

test('Tax Engine - Agricultural exemption up to 50MB', () => {
  const resExempt = calculateLandTaxTest(45000000, "agricultural");
  assert.equal(resExempt.tax, 0);

  const resTaxable = calculateLandTaxTest(60000000, "agricultural");
  // (60M - 50M) * 0.01% = 10M * 0.0001 = 1,000
  assert.equal(resTaxable.tax, 1000);
});

test('Tax Engine - Zero or negative value returns 0', () => {
  assert.equal(calculateLandTaxTest(0).tax, 0);
  assert.equal(calculateLandTaxTest(-5000).tax, 0);
});
