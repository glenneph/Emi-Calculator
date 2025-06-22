document.addEventListener('DOMContentLoaded', () => {

    // Get DOM elements for inputs
    const loanAmountInput = document.getElementById('loanAmount');
    const interestRateInput = document.getElementById('interestRate');
    const tenureInput = document.getElementById('tenure');

    // Get DOM elements for outputs
    const monthlyEmiOutput = document.getElementById('monthlyEmi');
    const totalInterestOutput = document.getElementById('totalInterest');
    const totalAmountOutput = document.getElementById('totalAmount');
    const inflationLossOutput = document.getElementById('inflationLoss');

    // Function to format numbers to Indian numbering system
    const formatToIndianCurrency = (num) => {
        return new Intl.NumberFormat('en-IN', {
            maximumFractionDigits: 0
        }).format(num);
    };

    // Main calculation function
    function calculateEMI() {
        // Get values from inputs and convert them to numbers
        const P = parseFloat(loanAmountInput.value); // Principal loan amount
        const annualInterestRate = parseFloat(interestRateInput.value); // Annual interest rate
        const tenureInYears = parseFloat(tenureInput.value); // Loan tenure in years
        const INFLATION_RATE = 5.85; // Average annual inflation rate in percent

        // Validate inputs: if any are not a positive number, reset all outputs and stop
        if (isNaN(P) || P <= 0 || isNaN(annualInterestRate) || annualInterestRate < 0 || isNaN(tenureInYears) || tenureInYears <= 0) {
            monthlyEmiOutput.textContent = '0';
            totalInterestOutput.textContent = '0';
            totalAmountOutput.textContent = '0';
            inflationLossOutput.textContent = '0';
            return;
        }

        // --- Calculation for the ACTUAL Loan (for display) ---
        const r_actual = (annualInterestRate / 12) / 100; // Monthly interest rate for the actual loan
        const n = tenureInYears * 12; // Tenure in months

        let emi = 0;
        let totalAmountPayable = P;
        let totalInterestPayable = 0;

        if (r_actual > 0) {
            emi = (P * r_actual * Math.pow(1 + r_actual, n)) / (Math.pow(1 + r_actual, n) - 1);
            totalAmountPayable = emi * n;
            totalInterestPayable = totalAmountPayable - P;
        } else {
             emi = P / n; // For 0% interest
        }

        // --- NEW: Inflation Adjusted Loss Calculation (Revised Logic) ---

        // 1. Calculate the real interest rate (interest rate minus inflation)
        // Use Math.max to ensure it doesn't go below 0
        const adjustedInterestRate = Math.max(0, annualInterestRate - INFLATION_RATE);
        
        let inflationAdjustedLoss = 0;

        // 2. Only calculate loss if the real rate is positive
        if (adjustedInterestRate > 0) {
            // 3. Calculate the total interest paid on a HYPOTHETICAL loan at this "real" rate
            const r_adjusted = (adjustedInterestRate / 12) / 100; // Monthly "real" interest rate
            
            // Calculate the EMI for this hypothetical loan
            const emi_adjusted = (P * r_adjusted * Math.pow(1 + r_adjusted, n)) / (Math.pow(1 + r_adjusted, n) - 1);
            
            // Calculate the total amount you'd pay for this hypothetical loan
            const totalPayable_adjusted = emi_adjusted * n;
            
            // The inflation-adjusted loss is the total interest from this hypothetical loan
            inflationAdjustedLoss = totalPayable_adjusted - P;
        }

        // --- Update the DOM with all calculated values ---
        monthlyEmiOutput.textContent = formatToIndianCurrency(emi);
        totalAmountOutput.textContent = formatToIndianCurrency(totalAmountPayable);
        totalInterestOutput.textContent = formatToIndianCurrency(totalInterestPayable);
        inflationLossOutput.textContent = formatToIndianCurrency(inflationAdjustedLoss);
    }

    // Add event listeners to all inputs to recalculate on any change
    [loanAmountInput, interestRateInput, tenureInput].forEach(input => {
        input.addEventListener('input', calculateEMI);
    });

    // Perform an initial calculation when the page loads
    calculateEMI();
});