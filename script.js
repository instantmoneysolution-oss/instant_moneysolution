function formatINR(amount) {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}


// ===============================
// ELIGIBILITY CALCULATOR
// ===============================

function calculate() {

  const incomeEl = document.getElementById('income-2');
  const emisEl = document.getElementById('emis-2');
  const homeLoanEl = document.getElementById('home-loan');
  const rateEl = document.getElementById('rate');
  const tenureEl = document.getElementById('tenure');

  if (!incomeEl || !emisEl || !rateEl || !tenureEl) {
    console.error('Eligibility calculator elements not found.');
    return;
  }

  const income = parseFloat(incomeEl.value) || 0;
  const emis = parseFloat(emisEl.value) || 0;
  const rate = parseFloat(rateEl.value) || 0;
  const tenure = parseFloat(tenureEl.value) || 0;
  const homeLoan = homeLoanEl ? homeLoanEl.value : 'no';


  // Display slider values
  const rateOutEl = document.getElementById('rate-out');
  const tenureOutEl = document.getElementById('tenure-out');

  if (rateOutEl) {
    rateOutEl.textContent = rate.toFixed(1);
  }

  if (tenureOutEl) {
    tenureOutEl.textContent = tenure;
  }


  // FOIR calculation
  const foirCap = homeLoan === 'yes' ? 0.75 : 0.65;

  const maxTotalEmi = income * foirCap;

  const maxEmi = Math.max(
    0,
    maxTotalEmi - emis
  );


  // Loan calculation
  const monthlyRate = rate / 12 / 100;
  const months = tenure * 12;

  let eligibleLoan = 0;

  if (
    monthlyRate > 0 &&
    months > 0 &&
    maxEmi > 0
  ) {

    eligibleLoan =
      maxEmi *
      (
        Math.pow(1 + monthlyRate, months) - 1
      ) /
      (
        monthlyRate *
        Math.pow(1 + monthlyRate, months)
      );

  }


  // Display results
  const eligibleAmountEl =
    document.getElementById('eligible-amount');

  const maxEmiEl =
    document.getElementById('max-emi');


  if (eligibleAmountEl) {
    eligibleAmountEl.textContent =
      formatINR(eligibleLoan);
  }

  if (maxEmiEl) {
    maxEmiEl.textContent =
      formatINR(maxEmi) + '/mo';
  }

}


// ===============================
// PAGE LOAD
// ===============================

document.addEventListener('DOMContentLoaded', function () {


  // ===============================
  // CALCULATOR EVENTS
  // ===============================

  const calculatorFields = [
    'income-2',
    'emis-2',
    'home-loan',
    'rate',
    'tenure'
  ];


  calculatorFields.forEach(function (id) {

    const el = document.getElementById(id);

    if (el) {

      el.addEventListener('input', calculate);
      el.addEventListener('change', calculate);

    }

  });


  // Calculate immediately when page loads
  calculate();


  // ===============================
  // LOAN FORM SUBMISSION
  // ===============================

  const loanForm =
    document.querySelector('.form-for-submit form');


  if (loanForm) {

    loanForm.addEventListener(
      'submit',
      async function (e) {

        e.preventDefault();

        const submitButton =
          loanForm.querySelector('#Submit-button');


        if (submitButton) {

          submitButton.disabled = true;
          submitButton.textContent = 'Submitting...';

        }


        try {

          const formData =
            new FormData(loanForm);


          const response =
            await fetch(
              loanForm.action,
              {
                method: 'POST',
                body: formData,
                headers: {
                  'Accept': 'application/json'
                }
              }
            );


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
              ">
                🎉
              </div>

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

          console.error(error);


          if (submitButton) {

            submitButton.disabled = false;
            submitButton.textContent = 'Submit';

          }


          alert(
            'Something went wrong. Please try again.'
          );

        }

      }
    );

  }

});