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



document.addEventListener('DOMContentLoaded', function () {
  const loanForm = document.querySelector('.form-for-submit form');

  if (loanForm) {
    loanForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const submitButton = loanForm.querySelector('#Submit-button');

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
      }

      try {
        const formData = new FormData(loanForm);

        const response = await fetch(loanForm.action, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Submission failed');
        }

        loanForm.innerHTML = `
          <div style="
            text-align:center;
            padding:50px 20px;
          ">
            <div style="
              font-size:32px;
              margin-bottom:15px;
            ">🎉</div>

            <h2 style="
              font-size:26px;
              margin-bottom:12px;
            ">
              Congratulations!
            </h2>

            <p style="
              font-size:19px;
              font-weight:600;
              margin-bottom:10px;
            ">
              Request Submitted to Operations Team
            </p>

            <p style="
              font-size:17px;
              line-height:1.5;
            ">
              You will get a call within
              <strong>2–6 working hours.</strong>
            </p>
          </div>
        `;

      } catch (error) {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Submit';
        }

        alert('Something went wrong. Please try again.');
      }
    });
  }
});
  calculate();
});
