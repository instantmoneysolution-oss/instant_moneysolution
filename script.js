function formatINR(amount) {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function calculate() {
  const income = parseFloat(document.getElementById('income').value) || 0;
  const emis = parseFloat(document.getElementById('emis').value) || 0;
  const age = parseFloat(document.getElementById('age').value) || 0;
  const employment = document.getElementById('emp').value;
  const rate = parseFloat(document.getElementById('rate').value);
  const tenure = parseFloat(document.getElementById('tenure').value);

  document.getElementById('rate-out').textContent = rate.toFixed(1);
  document.getElementById('tenure-out').textContent = tenure;

  const foirCap = employment === 'salaried' ? 0.5 : 0.4;
  const maxTotalEmi = income * foirCap;
  const maxEmi = Math.max(0, maxTotalEmi - emis);

  const monthlyRate = rate / 12 / 100;
  const months = tenure * 12;

  let eligibleLoan = 0;
  if (monthlyRate > 0 && maxEmi > 0) {
    eligibleLoan = maxEmi * (Math.pow(1 + monthlyRate, months) - 1) /
                   (monthlyRate * Math.pow(1 + monthlyRate, months));
  }

  document.getElementById('eligible-amount').textContent = formatINR(eligibleLoan);
  document.getElementById('max-emi').textContent = formatINR(maxEmi) + '/mo';

  const statusBox = document.getElementById('status-box');
  const statusText = document.getElementById('status-text');
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

['income', 'emis', 'age', 'emp', 'rate', 'tenure'].forEach(function (id) {
  document.getElementById(id).addEventListener('input', calculate);
});

calculate();
