function formatINR(amount) {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function calculate() {
  const incomeEl = document.getElementById('income-2');
  const emisEl = document.getElementById('emis-2');
  const homeLoanEl = document.getElementById('home-loan');
  const rateEl = document.getElementById('rate');
  const tenureEl = document.getElementById('tenure');

  if (!incomeEl || !emisEl || !rateEl || !tenureEl) {
    return;
  }

  const income = parseFloat(incomeEl.value) || 0;
  const emis = parseFloat(emisEl.value) || 0;
  const rate = parseFloat(rateEl.value);
  const tenure = parseFloat(tenureEl.value);
  const homeLoan = homeLoanEl ? homeLoanEl.value : 'no';

  const rateOutEl = document.getElementById('rate-out');
  const tenureOutEl = document.getElementById('tenure-out');
  if (rateOutEl) rateOutEl.textContent = rate.toFixed(1);
  if (tenureOutEl) tenureOutEl.textContent = tenure;

const foirCap = homeLoan === 'yes' ? 0.75 : 0.65;
  const maxTotalEmi = income * foirCap;
  const maxEmi = Math.max(0, maxTotalEmi - emis);

  const monthlyRate = rate / 12 / 100;
  const months = tenure * 12;

  let eligibleLoan = 0;
  if (monthlyRate > 0 && maxEmi > 0) {
    eligibleLoan = maxEmi * (Math.pow(1 + monthlyRate, months) - 1) /
                   (monthlyRate * Math.pow(1 + monthlyRate, months));
  }

  const eligibleAmountEl = document.getElementById('eligible-amount');
  const maxEmiEl = document.getElementById('max-emi');
  if (eligibleAmountEl) eligibleAmountEl.textContent = formatINR(eligibleLoan);
  if (maxEmiEl) maxEmiEl.textContent = formatINR(maxEmi) + '/mo';




}

document.addEventListener('DOMContentLoaded', function () {
['income-2', 'emis-2', 'home-loan', 'rate', 'tenure'].forEach(function (id) {    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);
    }
  });

  calculate();
});
