document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const headerEl = document.querySelector('header'); // Get header for measurement
    const headerBtns = document.querySelector('.header-buttons');
    const loanAmountInput = document.getElementById('loanAmount');
    const interestRateInput = document.getElementById('interestRate');
    const tenureInput = document.getElementById('tenure');
    const moratoriumInput = document.getElementById('moratorium');
    const allInputs = [loanAmountInput, interestRateInput, tenureInput, moratoriumInput];
    const summaryEmiEl = document.getElementById('summary-emi');
    const summaryInterestEl = document.getElementById('summary-interest');
    const summaryTotalEl = document.getElementById('summary-total');
    const summaryInflationLossEl = document.getElementById('summary-inflation-loss');
    const amortizationBody = document.getElementById('amortization-body');
    const amortizationContainer = document.querySelector('.amortization-table-container');
    const settingsBtn = document.querySelector('.settings-btn');
    const configPopover = document.getElementById('config-popover');
    const startDateInput = document.getElementById('startDate');
    const dateWarningEl = document.getElementById('date-schedule-warning');
    const prepaymentContainer = document.getElementById('prepayment-container');
    const prepaymentBtn = document.getElementById('prepayment-btn');
    const prepaymentModalOverlay = document.getElementById('prepayment-modal-overlay');
    const modalCloseBtn = document.getElementById('prepayment-modal-close-btn');
    const howToUseModalOverlay = document.getElementById('how-to-use-modal-overlay');
    const howToUseModalCloseBtn = document.getElementById('how-to-use-modal-close-btn');
    const howToUseBtn = document.getElementById('how-to-use-btn');
    const howToUseIframe = howToUseModalOverlay.querySelector('iframe');
    const howToUseOriginalSrc = howToUseIframe?.src || '';
    const prepaymentCustomBody = document.getElementById('prepayment-custom-body');
    const addPrepaymentRowBtn = document.getElementById('add-prepayment-row-btn');
    const prepaymentSubmitBtn = document.getElementById('prepayment-submit-btn');
    const customTabBtn = document.querySelector('.tab-btn[data-tab="custom"]');
    const templatesTabBtn = document.querySelector('.tab-btn[data-tab="templates"]');
    const blogsBtn = document.getElementById('blogs-btn');


    // ▼▼▼ DYNAMIC HEADER HEIGHT LOGIC ▼▼▼
    function updateDrawerPosition() {
        if (!headerEl) return;
        const headerHeight = headerEl.offsetHeight;
        document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
    }
    // ▲▲▲ END OF DYNAMIC HEADER LOGIC ▲▲▲


    // --- STATE & CONSTANTS ---
    let originalScheduleData = [];
    let fullScheduleData = [];
    let todayDateString = "";
    const INFLATION_RATE = 5.85;
    let customPrepaymentRows = [];
    let overallLoanStartDate = new Date();
    let overallLoanEndDate = new Date();
    let originalMetrics = null;

    // --- HELPER FUNCTIONS ---
    const formatToIndianCurrency = (num) => {
        if (isNaN(num) || num === undefined) return "-";
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(num);
    };

    const resetUI = () => {
        summaryEmiEl.textContent = "-";
        summaryInterestEl.textContent = "-";
        summaryTotalEl.textContent = "-";
        summaryInflationLossEl.textContent = "-";
        amortizationBody.innerHTML = `<tr class="placeholder-row"><td colspan="6">-</td></tr>`;
        amortizationContainer.classList.add('hidden');
        if (prepaymentContainer) {
            prepaymentContainer.style.display = 'none';
        }
        document.querySelectorAll('.savings-percent, .summary-sub').forEach(el => {
            el.classList.add('hidden');
            el.style.display = 'none';
        });
        [summaryInflationLossEl, summaryInterestEl, summaryTotalEl].forEach(el => {
            el.classList.remove('highlighted');
        });
        const tenureSavingsContainer = document.querySelector('.tenure-savings-container');
        if (tenureSavingsContainer) {
            tenureSavingsContainer.classList.add('hidden');
        }
    };

    // --- CORE LOGIC ---
    function calculateAndDisplayResults() {
        document.querySelectorAll('.savings-percent, .summary-sub').forEach(el => {
            el.classList.add('hidden');
            el.style.display = 'none';
        });
        const P = parseFloat(loanAmountInput.value);
        const annualInterestRate = parseFloat(interestRateInput.value);
        const tenureInYears = parseFloat(tenureInput.value);
        const moratoriumInYears = parseFloat(moratoriumInput.value) || 0;
        if (isNaN(P) || isNaN(annualInterestRate) || isNaN(tenureInYears) || P <= 0 || annualInterestRate <= 0 || tenureInYears <= 0) {
            resetUI();
            return;
        }
        amortizationContainer.classList.remove('hidden');
        if (prepaymentContainer) {
            prepaymentContainer.style.display = 'flex';
            prepaymentContainer.style.justifyContent = 'left';
        }
        const r_actual = (annualInterestRate / 12) / 100;
        const n = tenureInYears * 12;
        const m = moratoriumInYears * 12;
        let effectivePrincipal = P;
        if (m > 0) {
            effectivePrincipal = P * Math.pow(1 + r_actual, m);
        }
        const emi = (effectivePrincipal * r_actual * Math.pow(1 + r_actual, n)) / (Math.pow(1 + r_actual, n) - 1);
        const originalTotalInterest = (emi * n) - P;
        const originalTotalPaid = P + originalTotalInterest;
        originalMetrics = {
            principal: P,
            emi: emi,
            interest: originalTotalInterest,
            total: originalTotalPaid,
            schedule: [],
            annualInterestRate: annualInterestRate,
            inflationLoss: 0
        };
        const adjustedInterestRate = Math.max(0, annualInterestRate - INFLATION_RATE);
        if (adjustedInterestRate > 0) {
            const r_adjusted = (adjustedInterestRate / 12) / 100;
            let effectivePrincipal_adjusted = P;
            if (m > 0) {
                effectivePrincipal_adjusted = P * Math.pow(1 + r_adjusted, m);
            }
            const emi_adjusted = (effectivePrincipal_adjusted * r_adjusted * Math.pow(1 + r_adjusted, n)) / (Math.pow(1 + r_adjusted, n) - 1);
            if (isFinite(emi_adjusted)) {
                originalMetrics.inflationLoss = (emi_adjusted * n) - P;
            }
        }
        updateSummary(originalMetrics);
        const dateParts = startDateInput.value.split('-');
        if (dateParts.length === 3) {
            const day = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1;
            const year = parseInt(dateParts[2], 10);
            const startDate = new Date(year, month, day);
            if (!isNaN(startDate)) {
                originalScheduleData = generateAmortizationData(P, emi, r_actual, n, m, startDate.getMonth(), startDate.getFullYear());
                originalMetrics.schedule = originalScheduleData;
                fullScheduleData = [...originalScheduleData];
                renderAmortizationTable(fullScheduleData);
                overallLoanStartDate = new Date(startDate);
                const totalLoanMonths = n + m;
                overallLoanEndDate = new Date(startDate);
                overallLoanEndDate.setMonth(overallLoanEndDate.getMonth() + totalLoanMonths);
                setupCustomPrepaymentTab();
            }
        }
    }

    // ... (The rest of the JS functions are unchanged)

    function updateSummary(currentMetrics, original = null) {
        summaryEmiEl.textContent = formatToIndianCurrency(currentMetrics.emi);
        if (original) {
            summaryInflationLossEl.textContent = formatToIndianCurrency(currentMetrics.inflationLoss || 0);
            summaryInflationLossEl.classList.add('highlighted');
            const inflationSaved = (original.inflationLoss || 0) - (currentMetrics.inflationLoss || 0);
            const inflationSavedPercent = original.inflationLoss > 0 ? (inflationSaved / original.inflationLoss) * 100 : 0;
            const inflationPercentEl = document.getElementById('inflation-loss-percent');
            const inflationSavedEl = document.getElementById('inflation-loss-saved');
            if (inflationPercentEl && inflationSavedEl) {
                inflationPercentEl.textContent = `-${inflationSavedPercent.toFixed(0)}%`;
                inflationSavedEl.textContent = formatToIndianCurrency(inflationSaved);
                inflationPercentEl.classList.remove('hidden');
                inflationPercentEl.style.display = 'block';
                inflationSavedEl.closest('.summary-sub').classList.remove('hidden');
                inflationSavedEl.closest('.summary-sub').style.display = 'block';
            }
            summaryInterestEl.textContent = formatToIndianCurrency(currentMetrics.interest);
            summaryInterestEl.classList.add('highlighted');
            const interestSaved = original.interest - currentMetrics.interest;
            const interestSavedPercent = original.interest > 0 ? (interestSaved / original.interest) * 100 : 0;
            const interestPercentEl = document.getElementById('interest-percent');
            const interestSavedEl = document.getElementById('interest-saved');
            if (interestPercentEl && interestSavedEl) {
                interestPercentEl.textContent = `-${interestSavedPercent.toFixed(0)}%`;
                interestSavedEl.textContent = formatToIndianCurrency(interestSaved);
                interestPercentEl.classList.remove('hidden');
                interestPercentEl.style.display = 'block';
                interestSavedEl.closest('.summary-sub').classList.remove('hidden');
                interestSavedEl.closest('.summary-sub').style.display = 'block';
            }
            summaryTotalEl.textContent = formatToIndianCurrency(currentMetrics.total);
            summaryTotalEl.classList.add('highlighted');
            const totalSaved = original.total - currentMetrics.total;
            const totalSavedPercent = original.total > 0 ? (totalSaved / original.total) * 100 : 0;
            const totalPercentEl = document.getElementById('total-percent');
            const totalSavedEl = document.getElementById('total-saved');
            if (totalPercentEl && totalSavedEl) {
                totalPercentEl.textContent = `-${totalSavedPercent.toFixed(0)}%`;
                totalSavedEl.textContent = formatToIndianCurrency(totalSaved);
                totalPercentEl.classList.remove('hidden');
                totalPercentEl.style.display = 'block';
                totalSavedEl.closest('.summary-sub').classList.remove('hidden');
                totalSavedEl.closest('.summary-sub').style.display = 'block';
            }
            const tenureSavingsContainer = document.querySelector('.tenure-savings-container');
            const tenureSavingsTextEl = document.getElementById('tenure-savings-text');
            if (tenureSavingsContainer && tenureSavingsTextEl && currentMetrics.schedule && original.schedule) {
                const originalActiveLoanMonths = original.schedule.filter(entry => entry.balance > 0 || entry.emi > 0).length;
                const newActiveLoanMonths = currentMetrics.schedule.filter(entry => entry.balance > 0 || entry.emi > 0).length;
                const tenureReductionMonths = originalActiveLoanMonths - newActiveLoanMonths;
                if (tenureReductionMonths > 0) {
                    const yearsReduced = Math.floor(tenureReductionMonths / 12);
                    const monthsReduced = tenureReductionMonths % 12;
                    let tenureTextParts = [];
                    if (yearsReduced > 0) tenureTextParts.push(`${yearsReduced} year${yearsReduced > 1 ? 's' : ''}`);
                    if (monthsReduced > 0) tenureTextParts.push(`${monthsReduced} month${monthsReduced > 1 ? 's' : ''}`);
                    const dyn = tenureTextParts.join(' & ');
                    tenureSavingsTextEl.innerHTML = `you'll close your loan <span class="tenure-highlight">${dyn}</span> prior`;
                    tenureSavingsContainer.classList.remove('hidden');
                } else {
                    tenureSavingsContainer.classList.add('hidden');
                }
            }
        } else {
            summaryInflationLossEl.textContent = formatToIndianCurrency(currentMetrics.inflationLoss || 0);
            summaryInterestEl.textContent = formatToIndianCurrency(currentMetrics.interest);
            summaryTotalEl.textContent = formatToIndianCurrency(currentMetrics.total);
            [summaryInflationLossEl, summaryInterestEl, summaryTotalEl].forEach(el => el.classList.remove('highlighted'));
            document.querySelectorAll('.savings-percent, .summary-sub').forEach(el => {
                el.classList.add('hidden');
                el.style.display = 'none';
            });
            const tenureSavingsContainer = document.querySelector('.tenure-savings-container');
            if (tenureSavingsContainer) {
                tenureSavingsContainer.classList.add('hidden');
            }
        }
    }
    
function renderAmortizationTable(schedule) {
  amortizationBody.innerHTML = "";
  if (!schedule || schedule.length === 0) {
    amortizationBody.innerHTML = `<tr class="placeholder-row"><td colspan="6">-</td></tr>`;
    return;
  }

  const yearlyData = schedule.reduce((acc, row) => {
    if (!acc[row.year]) acc[row.year] = true;
    return acc;
  }, {});

  let tableHTML = "";
  // If ANY month has prepayments, reserve 6 columns; else 5
  const hasPrepaymentsAnywhere = schedule.some(row => row.prepayment > 0);

  for (const year in yearlyData) {
    const colSpan = hasPrepaymentsAnywhere ? 6 : 5;
    tableHTML += `
      <tr class="year-row" data-year="${year}">
        <td colspan="${colSpan}">
          <div class="year-cell">
            <span>${year}</span>
            <img src="assets/chevron.svg" alt="Toggle Details" class="toggle-icon">
          </div>
        </td>
      </tr>`;
  }
  amortizationBody.innerHTML = tableHTML;
}

    function generateAmortizationData(principal, emi, monthlyRate, tenureMonths, moratoriumMonths, startMonthIndex, startYear) {
        let balance = principal;
        const schedule = [];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const totalDurationInMonths = moratoriumMonths + tenureMonths;
        for (let i = 0; i < totalDurationInMonths; i++) {
            const currentMonthIndex = (startMonthIndex + i) % 12;
            const currentYear = startYear + Math.floor((startMonthIndex + i) / 12);
            const interestPayment = balance * monthlyRate;
            let principalPayment = 0;
            let totalPayment = 0;
            if (i < moratoriumMonths) {
                balance += interestPayment;
            } else {
                principalPayment = emi - interestPayment;
                totalPayment = emi;
                balance -= principalPayment;
            }
            schedule.push({
                year: currentYear,
                month: monthNames[currentMonthIndex],
                principal: principalPayment,
                interest: interestPayment,
                emi: totalPayment,
                prepayment: 0,
                total: totalPayment,
                totalPayment: totalPayment,
                balance: balance > 0 ? balance : 0
            });
        }
        return schedule;
    }

    function setupCustomPrepaymentTab() {
        customPrepaymentRows = [];
        if (prepaymentCustomBody) {
             prepaymentCustomBody.innerHTML = '';
        }
        const firstRow = {
            id: Date.now(),
            startDate: overallLoanStartDate,
            endDate: overallLoanEndDate,
            amount: ''
        };
        customPrepaymentRows.push(firstRow);
        const firstRowEl = createPrepaymentRowElement(firstRow, 0);
        if (prepaymentCustomBody) {
             prepaymentCustomBody.appendChild(firstRowEl);
        }
    }

    function createPrepaymentRowElement(rowData, index) {
        if (!prepaymentCustomBody) return document.createElement('tr');
        const tr = document.createElement('tr');
        tr.dataset.index = index;
        tr.dataset.id = rowData.id;
        tr.innerHTML = `
            <td class="prepayment-date-cell">
                <div id="prep-start-${rowData.id}" class="input-field-wrapper">
                    <input type="text" data-input>
                    <img src="assets/calendar.svg" alt="Select Date" class="date-picker-icon" data-toggle>
                </div>
            </td>
            <td class="prepayment-date-cell">
                <div id="prep-end-${rowData.id}" class="input-field-wrapper">
                    <input type="text" data-input>
                    <img src="assets/calendar.svg" alt="Select Date" class="date-picker-icon" data-toggle>
                </div>
            </td>
            <td>
                <div class="input-field-wrapper">
                    <span class="prefix" style="padding: 8px; height: auto;">₹</span>
                    <input type="number" class="prepayment-amount-input" placeholder="Enter amount" value="${rowData.amount || ''}" style="text-align: right;">
                </div>
            </td>
            <td class="delete-cell" style="text-align: right; vertical-align: middle;">
                <img src="assets/trash.svg" alt="Delete" class="${index === 0 ? 'delete-icon delete-icon-disabled' : 'delete-icon'}" style="cursor: ${index === 0 ? 'not-allowed' : 'pointer'}; width: 20px; height: 20px; ${index === 0 ? 'opacity: 0.5; filter: grayscale(100%);' : ''}">
            </td>`;
        
        const startPickerEl = tr.querySelector(`#prep-start-${rowData.id}`);
        const endPickerEl = tr.querySelector(`#prep-end-${rowData.id}`);
        const prevRowEndDate = index > 0 ? customPrepaymentRows[index - 1].endDate : null;
        rowData.startPicker = flatpickr(startPickerEl, { wrap: true, dateFormat: "d-m-Y", defaultDate: rowData.startDate, minDate: prevRowEndDate ? new Date(prevRowEndDate).fp_incr(1) : overallLoanStartDate, maxDate: overallLoanEndDate, onChange: (d) => { rowData.startDate = d[0]; }});
        rowData.endPicker = flatpickr(endPickerEl, { wrap: true, dateFormat: "d-m-Y", defaultDate: rowData.endDate, minDate: rowData.startDate || overallLoanStartDate, maxDate: overallLoanEndDate, onChange: (d) => { rowData.endDate = d[0]; }});
        if (index > 0) {
            const deleteIcon = tr.querySelector('.delete-icon');
            if (deleteIcon && !deleteIcon.classList.contains('delete-icon-disabled')) {
                deleteIcon.addEventListener('click', () => {
                    tr.remove();
                    const rowIndexInArray = customPrepaymentRows.findIndex(r => r.id == rowData.id);
                    if (rowIndexInArray !== -1) {
                        customPrepaymentRows.splice(rowIndexInArray, 1);
                    }
                });
            }
        }
        return tr;
    }
    
    if (addPrepaymentRowBtn) {
        addPrepaymentRowBtn.addEventListener('click', () => {
            if (!prepaymentCustomBody || customPrepaymentRows.length === 0) return;
            const lastRow = customPrepaymentRows[customPrepaymentRows.length - 1];
            if (!lastRow || !lastRow.endDate) return;
            const newStartDate = new Date(lastRow.endDate);
            newStartDate.setDate(newStartDate.getDate() + 1);
            if (newStartDate >= overallLoanEndDate) {
                alert("No more time available in the loan tenure to add another prepayment period.");
                return;
            }
            const newRow = { id: Date.now(), startDate: newStartDate, endDate: overallLoanEndDate, amount: '' };
            customPrepaymentRows.push(newRow);
            const newRowEl = createPrepaymentRowElement(newRow, customPrepaymentRows.length - 1);
            prepaymentCustomBody.appendChild(newRowEl);
            if(lastRow.endPicker) lastRow.endPicker.set('maxDate', new Date(newStartDate).fp_incr(-1));
        });
    }
    
    if (prepaymentCustomBody) {
        prepaymentCustomBody.addEventListener('input', (e) => {
            if (e.target.classList.contains('prepayment-amount-input')) {
                const tr = e.target.closest('tr');
                if (!tr) return;
                const index = parseInt(tr.dataset.index, 10);
                if (!isNaN(index) && customPrepaymentRows[index]) {
                    customPrepaymentRows[index].amount = parseFloat(e.target.value) || 0;
                }
            }
        });
    }

    function validateSinglePrepaymentRow(row) {
        const amount = parseFloat(row.amount);
        return !(isNaN(amount) || amount <= 0 || !(row.startDate instanceof Date) || !(row.endDate instanceof Date) || row.endDate < row.startDate);
    }
    
    function generate16EMIRulePrepayments(emiAmount, loanStartDate, totalLoanMonths) {
        const prepaymentMap = {};
        let currentDate = new Date(loanStartDate);
        for (let monthIndex = 0; monthIndex < totalLoanMonths; monthIndex++) {
            const cyclePosition = monthIndex % 3;
            if (cyclePosition === 2) {
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth() + 1;
                prepaymentMap[`${year}-${month}`] = emiAmount;
            }
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
        return prepaymentMap;
    }
    
    function applyPrepaymentsAndRecalculate() {
        const isCustomTabActive = customTabBtn && customTabBtn.classList.contains('active');
        const isTemplatesTabActive = templatesTabBtn && templatesTabBtn.classList.contains('active');
        let prepaymentRows = [];
        if(isCustomTabActive) {
            prepaymentRows = customPrepaymentRows.filter(validateSinglePrepaymentRow);
            if (prepaymentRows.length !== customPrepaymentRows.filter(r => r.amount > 0).length) {
                alert("Please correct the inputs in the Custom prepayment entries.");
                return;
            }
        } else if (isTemplatesTabActive) {
            const selectedTemplate = document.querySelector('input[name="prepayment_template"]:checked');
            if (!selectedTemplate) return alert("Please select a template.");
            if (selectedTemplate.value === '16-emi' && originalMetrics && originalScheduleData.length > 0) {
                const totalLoanMonths = originalScheduleData.length;
                const prepaymentMap = generate16EMIRulePrepayments(originalMetrics.emi, overallLoanStartDate, totalLoanMonths);
                prepaymentRows = Object.keys(prepaymentMap).map(key => {
                    const [year, month] = key.split('-').map(Number);
                    const startDate = new Date(year, month - 1, 1);
                    const endDate = new Date(year, month, 0);
                    return { startDate, endDate, amount: prepaymentMap[key] };
                });
            }
        } else {
            return;
        }
        const { schedule: rawSchedule, prepayments: monthlyPrepayments } = calculateScheduleWithPrepayments(originalScheduleData, prepaymentRows, overallLoanStartDate);
        const payoffIdx = rawSchedule.findIndex(entry => entry.balance <= 0);
        const trimmedSchedule = payoffIdx >= 0 ? rawSchedule.slice(0, payoffIdx + 1) : rawSchedule;
        fullScheduleData = trimmedSchedule;
        renderAmortizationTable(trimmedSchedule, monthlyPrepayments);
        updateSummaryWithSavings(trimmedSchedule, monthlyPrepayments);
        closePrepaymentModal();
    }
    
    function calculateScheduleWithPrepayments(originalSchedule, prepaymentRows, loanStartDate) {
        let newSchedule = JSON.parse(JSON.stringify(originalSchedule));
        const prepaymentMap = {};
        prepaymentRows.forEach(row => {
            let currentDate = new Date(row.startDate);
            while (currentDate <= row.endDate) {
                const key = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`;
                prepaymentMap[key] = (prepaymentMap[key] || 0) + parseFloat(row.amount);
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        });
        let runningBalance = parseFloat(loanAmountInput.value) || 0;
        let loanClosed = false;
        const monthlyRate = (parseFloat(interestRateInput.value) / 12) / 100;
        const moratoriumMonths = (parseFloat(moratoriumInput.value) || 0) * 12;
        for (let i = 0; i < newSchedule.length; i++) {
            const entry = newSchedule[i];
            if (loanClosed) {
                Object.keys(entry).forEach(k => { if (typeof entry[k] === 'number' && k !== 'year' && k !== 'month') entry[k] = 0; });
                continue;
            }
            const isMoratoriumMonth = i < moratoriumMonths;
            const interestForMonth = runningBalance * monthlyRate;
            entry.interest = interestForMonth;
            if (isMoratoriumMonth) {
                runningBalance += interestForMonth;
                entry.principal = 0;
                entry.emi = 0;
            } else {
                let principalFromEmi = entry.emi - interestForMonth;
                if (principalFromEmi < 0) principalFromEmi = 0;
                const monthKey = `${entry.year}-${new Date(Date.parse(entry.month +" 1, 2012")).getMonth() + 1}`;
                const monthlyPrepayment = prepaymentMap[monthKey] || 0;
                entry.prepayment = monthlyPrepayment;
                const totalPrincipalReduction = principalFromEmi + monthlyPrepayment;
                if (runningBalance <= totalPrincipalReduction) {
                    entry.prepayment = runningBalance - principalFromEmi > 0 ? runningBalance - principalFromEmi : 0;
                    entry.principal = principalFromEmi;
                    if(runningBalance < principalFromEmi) entry.principal = runningBalance;
                    entry.emi = entry.principal + interestForMonth;
                    runningBalance = 0;
                    loanClosed = true;
                } else {
                    runningBalance -= totalPrincipalReduction;
                    entry.principal = principalFromEmi;
                }
            }
            entry.total = entry.emi + entry.prepayment;
            entry.totalPayment = entry.total;
            entry.balance = runningBalance;
        }
        return { schedule: newSchedule, prepayments: prepaymentMap };
    }
    
    function updateSummaryWithSavings(newSchedule, monthlyPrepayments) {
        if (!newSchedule || newSchedule.length === 0 || !originalMetrics) return;
        const principalAmount = parseFloat(loanAmountInput.value) || 0;
        const newTotalInterest = newSchedule.reduce((sum, entry) => sum + (entry.interest || 0), 0);
        const newTotalAmount = principalAmount + newTotalInterest;
        let newInflationLoss = 0;
        const adjustedRate = Math.max(0, originalMetrics.annualInterestRate - INFLATION_RATE);
        if (adjustedRate > 0) {
            const r_adjusted = (adjustedRate / 12) / 100;
            const actualMonthsPaid = newSchedule.filter(e => e.balance > 0 || e.emi > 0).length;
            const moratoriumMonths = (parseFloat(moratoriumInput.value) || 0) * 12;
            let effectivePrincipal_adjusted = principalAmount;
            if (moratoriumMonths > 0) {
                effectivePrincipal_adjusted = principalAmount * Math.pow(1 + r_adjusted, moratoriumMonths);
            }
            const emiAdjustedForNewN = (effectivePrincipal_adjusted * r_adjusted * Math.pow(1 + r_adjusted, actualMonthsPaid)) / (Math.pow(1 + r_adjusted, actualMonthsPaid) - 1);
            if(isFinite(emiAdjustedForNewN)) {
                newInflationLoss = (emiAdjustedForNewN * actualMonthsPaid) - principalAmount;
                newInflationLoss = Math.max(0, newInflationLoss);
            }
        }
        const newMetrics = {
            principal: principalAmount,
            emi: originalMetrics.emi,
            interest: newTotalInterest,
            total: newTotalAmount,
            schedule: newSchedule,
            annualInterestRate: originalMetrics.annualInterestRate,
            inflationLoss: newInflationLoss
        };
        updateSummary(newMetrics, originalMetrics);
    }
    
    function openPrepaymentModal() { if (prepaymentModalOverlay) prepaymentModalOverlay.classList.remove('hidden'); }
    function closePrepaymentModal() { if (prepaymentModalOverlay) prepaymentModalOverlay.classList.add('hidden'); }
    
    function openHowToUseModal() {
        if (howToUseIframe) howToUseIframe.src = howToUseOriginalSrc;
        if (howToUseModalOverlay) howToUseModalOverlay.classList.remove('hidden');
    }
    
    function closeHowToUseModal() {
        if (howToUseModalOverlay) howToUseModalOverlay.classList.add('hidden');
        if (howToUseIframe) howToUseIframe.src = '';
    }

    // --- EVENT LISTENERS ---
    allInputs.forEach(input => {
        input.addEventListener('input', () => {
            const max = parseFloat(input.max);
            if (input.value && parseFloat(input.value) > max) { input.value = max; }
            calculateAndDisplayResults();
        });
    });

    amortizationBody.addEventListener('click', function(e) {
        const yearRow = e.target.closest('.year-row');
        if (!yearRow) return;
        const year = yearRow.dataset.year;
        const wasOpen = yearRow.classList.contains('open');
        document.querySelector('.year-row.open')?.classList.remove('open');
        document.querySelector('.details-container-row')?.remove();
        if (!wasOpen) {
            yearRow.classList.add('open');
            const yearMonths = fullScheduleData.filter(row => row.year == year);
            const showingPrepayments = yearMonths.some(row => row.prepayment > 0);
            const colSpan = showingPrepayments ? 6 : 5;
            let totalPrincipal = 0, totalInterest = 0, totalPrepayment = 0, totalPayment = 0;
            let monthRowsHTML = yearMonths.map(row => {
  totalPrincipal  += row.principal || 0;
  totalInterest   += row.interest  || 0;
  totalPrepayment += row.prepayment || 0;
  totalPayment    += row.total     || 0;

  const totalDisplay     = row.emi > 0 ? formatToIndianCurrency(row.total)     : '<i>MORATORIUM</i>';
  const principalDisplay = row.emi > 0 ? formatToIndianCurrency(row.principal) : '<i>-</i>';

  if (showingPrepayments) {
    return `
      <tr>
        <td>${row.month}</td>
        <td>${principalDisplay}</td>
        <td>${formatToIndianCurrency(row.interest)}</td>
        <td>${formatToIndianCurrency(row.prepayment)}</td>
        <td>${totalDisplay}</td>
        <td>${formatToIndianCurrency(row.balance)}</td>
      </tr>`;
  } else {
    return `
      <tr>
        <td>${row.month}</td>
        <td>${principalDisplay}</td>
        <td>${formatToIndianCurrency(row.interest)}</td>
        <td>${totalDisplay}</td>
        <td>${formatToIndianCurrency(row.balance)}</td>
      </tr>`;
  }
}).join('');

           const headerHTML = showingPrepayments
  ? `<th>Month</th><th>To Principal</th><th>To Interest</th><th>Pre-payment</th><th>Total Payment</th><th>Balance</th>`
  : `<th>Month</th><th>To Principal</th><th>To Interest</th><th>Total Payment</th><th>Balance</th>`;

const footerHTML = showingPrepayments
  ? `<td>Summary</td><td>${formatToIndianCurrency(totalPrincipal)}</td><td>${formatToIndianCurrency(totalInterest)}</td><td>${formatToIndianCurrency(totalPrepayment)}</td><td>${formatToIndianCurrency(totalPayment)}</td><td>-</td>`
  : `<td>Summary</td><td>${formatToIndianCurrency(totalPrincipal)}</td><td>${formatToIndianCurrency(totalInterest)}</td><td>${formatToIndianCurrency(totalPayment)}</td><td>-</td>`;

const summaryBlock = showingPrepayments
  ? `
    <div class="summary-block">
      <div class="summary-top">
        <div class="summary-title">Summary</div>
        <div class="summary-balance">-</div>
      </div>
      <div class="summary-values with-prepay">
        <div class="sv">${formatToIndianCurrency(totalPrincipal)}</div>
        <div class="sv">${formatToIndianCurrency(totalInterest)}</div>
        <div class="sv">${formatToIndianCurrency(totalPrepayment)}</div>
        <div class="sv">${formatToIndianCurrency(totalPayment)}</div>
      </div>
    </div>`
  : `
    <div class="summary-block">
      <div class="summary-top">
        <div class="summary-title">Summary</div>
        <div class="summary-balance">-</div>
      </div>
      <div class="summary-values">
        <div class="sv">${formatToIndianCurrency(totalPrincipal)}</div>
        <div class="sv">${formatToIndianCurrency(totalInterest)}</div>
        <div class="sv">${formatToIndianCurrency(totalPayment)}</div>
      </div>
    </div>`;

const detailsTableHTML = `
  <table class="details-table">
    <thead><tr>${headerHTML}</tr></thead>
    <tbody>${monthRowsHTML}</tbody>
    <tfoot>
      <tr class="summary-row summary-desktop">${footerHTML}</tr>
      <tr class="summary-row summary-mobile">
        <td colspan="${colSpan}">${summaryBlock}</td>
      </tr>
    </tfoot>
  </table>
`;

const mobileLegendHTML = `
  <div class="mobile-legend" aria-hidden="true">
    <div class="legend-wrap">
      <div class="legend-row legend-top">
        <div class="legend-title">Month</div>
        <div class="legend-title legend-right">Balance</div>
      </div>
      <div class="legend-row legend-bottom">
        <div class="legend-chip col-30">To Principal</div>
        <div class="legend-chip col-30">To Interest</div>
        <div class="legend-chip col-40">Total Payment</div>
      </div>
    </div>
  </div>
`;

const detailsContainer = document.createElement('tr');
detailsContainer.className = 'details-container-row';
detailsContainer.innerHTML = `
  <td colspan="${colSpan}">
    ${mobileLegendHTML}
    ${detailsTableHTML}
  </td>
`;
yearRow.insertAdjacentElement('afterend', detailsContainer);
        }
    });

    if (howToUseBtn) howToUseBtn.addEventListener('click', openHowToUseModal);
    if (blogsBtn) blogsBtn.addEventListener('click', () => window.open('https://small-carnation-b33.notion.site/Blogs-Practices-to-become-DEBT-FREE-10x-faster-245fbe91669480cb8d45ca1e94ea06ad?source=copy_link', '_blank', 'noopener'));
    
    settingsBtn.addEventListener('click', (e) => { e.stopPropagation(); configPopover.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => {
        if (!configPopover.classList.contains('hidden') && !configPopover.contains(e.target) && !settingsBtn.contains(e.target) && !e.target.closest('.flatpickr-calendar')) {
            configPopover.classList.add('hidden');
        }
    });
    if (prepaymentBtn) prepaymentBtn.addEventListener('click', openPrepaymentModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closePrepaymentModal);
    if (prepaymentModalOverlay) prepaymentModalOverlay.addEventListener('click', (e) => { if (e.target === prepaymentModalOverlay) closePrepaymentModal(); });
    if (prepaymentSubmitBtn) prepaymentSubmitBtn.addEventListener('click', applyPrepaymentsAndRecalculate);
    
    if (howToUseModalCloseBtn) howToUseModalCloseBtn.addEventListener('click', closeHowToUseModal);
    if (howToUseModalOverlay) howToUseModalOverlay.addEventListener('click', (e) => { if (e.target === howToUseModalOverlay) closeHowToUseModal(); });

    const modalTabsContainer = document.querySelector('.modal-tabs');
    if(modalTabsContainer) {
        modalTabsContainer.addEventListener('click', e => {
            const clickedTab = e.target.closest('.tab-btn');
            if(!clickedTab) return;
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            clickedTab.classList.add('active');
            document.getElementById(clickedTab.dataset.tab)?.classList.add('active');
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (prepaymentModalOverlay && !prepaymentModalOverlay.classList.contains('hidden')) closePrepaymentModal();
            if (howToUseModalOverlay && !howToUseModalOverlay.classList.contains('hidden')) closeHowToUseModal();
        }
    });

    // --- INITIALIZATION ---
    flatpickr("#startDateWrapper", {
        wrap: true,
        dateFormat: "d-m-Y",
        defaultDate: "today",
        onReady: (d, dateStr) => { todayDateString = dateStr; },
        onChange: (d, dateStr) => {
            dateWarningEl.classList.toggle('hidden', dateStr === todayDateString);
            calculateAndDisplayResults();
        }
    });
    
    // Run the drawer position function on page load and on resize
    updateDrawerPosition();
    window.addEventListener('resize', updateDrawerPosition);

    resetUI();
    calculateAndDisplayResults();
    
    // --- DRAWER TOGGLE ---
    const menuToggle    = document.getElementById('menu-toggle');
    const drawer        = document.getElementById('mobile-drawer');
    const overlay       = document.getElementById('drawer-overlay');
    const drawerClose   = document.getElementById('drawer-close');
    const HAMBURGER_ICON = 'assets/menu.svg';
    const CLOSE_ICON     = 'assets/cancel.svg';
    if (headerBtns && drawer) {
        const clone = headerBtns.cloneNode(true);
        clone.classList.remove('header-buttons');
        clone.classList.add('drawer-buttons');
        drawer.appendChild(clone);
        const how = clone.querySelector('#how-to-use-btn');
        const blogs = clone.querySelector('#blogs-btn');
        if (how) {
            how.id = 'drawer-how-to-use-btn';
            how.addEventListener('click', () => {
                openHowToUseModal();
                toggleDrawer();
            });
        }
        if (blogs) {
            blogs.id = 'drawer-blogs-btn';
            blogs.addEventListener('click', () => {
                window.open('https://small-carnation-b33.notion.site/Blogs-Practices-to-become-DEBT-FREE-10x-faster-245fbe91669480cb8d45ca1e94ea06ad?source=copy_link', '_blank', 'noopener');
                toggleDrawer();
            });
        }
    }
    function toggleDrawer() {
        if (!drawer || !overlay || !menuToggle) return;
        const isOpen = drawer.classList.toggle('open');
        overlay.classList.toggle('open', isOpen);
        const img = menuToggle.querySelector('img');
        if (img) img.src = isOpen ? CLOSE_ICON : HAMBURGER_ICON;
    }
    if (menuToggle) menuToggle.addEventListener('click', toggleDrawer);
    if (overlay) overlay.addEventListener('click', toggleDrawer);
    if (drawerClose) drawerClose.addEventListener('click', toggleDrawer);
});