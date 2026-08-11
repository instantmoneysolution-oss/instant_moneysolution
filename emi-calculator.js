const principal = document.querySelector('#loan-amount-input');
const interest = document.querySelector('#Interest-rate-input');
const tenure = document.querySelector('#month-to-pay-input');
const calculateBtn = document.querySelector('#calculate');
const emi = document.querySelector('#emi');
const totalInterest = document.querySelector('#total-interest');

console.log(principal, interest, tenure);

function calculateEMI() {

    if (
        principal.value === '' ||
        interest.value === '' ||
        tenure.value === ''
    ) {
        alert('Please enter all the values');
        return;
    }

    const p = parseFloat(principal.value);
    const r = parseFloat(interest.value) / 1200;
    const n = parseInt(tenure.value);

    const emiValue =
        (p * r * Math.pow(1 + r, n)) /
        (Math.pow(1 + r, n) - 1);

    const totalPayment = emiValue * n;
    const interestValue = totalPayment - p;

    emi.textContent = emiValue.toFixed(2);

    if (totalInterest) {
        
        totalInterest.textContent = interestValue.toFixed(2);
    }
}

calculateBtn.addEventListener('click', calculateEMI);
