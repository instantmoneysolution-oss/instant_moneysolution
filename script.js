function formatINR(amount) {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function calculate() {
  const incomeEl = document.getElementById('income-2');
  const emisEl = document.getElementById('emis-2');
  const ageEl = document.getElementById('age-2');
  const empEl = document.getElementById('emp');
  const homeLoanEl = document.getElementById('home-loan');
  const rateEl = document.getElementById('rate');
  const tenureEl = document.getElementById('tenure');

  if (!incomeEl || !emisEl || !ageEl || !empEl || !rateEl || !tenureEl) {
    return;
  }

  const income = parseFloat(incomeEl.value) || 0;
  const emis = parseFloat(emisEl.value) || 0;
  const age = parseFloat(ageEl.value) || 0;
  const employment = empEl.value;
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

  const statusBox = document.getElementById('status-box');
  const statusText = document.getElementById('status-text');
  if (!statusBox || !statusText) return;

  statusBox.className = 'status';

  if (age < 18 || age > 75) {
    statusBox.classList.add('danger');
    statusText.textContent = 'Age is outside the typical lending window (18-75 years).';
  } else if (income <= 0 || maxEmi <= 0) {
    statusBox.classList.add('danger');
    statusText.textContent = 'Existing EMIs leave no room for a new loan at this income.';
  } else if (eligibleLoan < 50000) {
    statusBox.classList.add('warning');
    statusText.textContent = 'Eligible amount is quite low - most lenders have a minimum loan size.';
  } else {
    statusBox.classList.add('success');
    statusText.textContent = 'Likely eligible - actual offer depends on credit score and lender policy.';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  ['income-2', 'emis-2', 'age-2', 'emp', 'rate', 'tenure'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', calculate);
    }
  });

  calculate();
});
